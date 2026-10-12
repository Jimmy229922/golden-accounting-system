const path = require('path');
const fs = require('fs');
let Database;
try {
    if (process.versions && process.versions.electron) {
        Database = require('better-sqlite3');
    } else {
        Database = require(path.resolve(__dirname, '../../../../backend/node_modules/better-sqlite3'));
    }
} catch (_) {
    try {
        Database = require('better-sqlite3');
    } catch (e) {
        Database = require(path.resolve(__dirname, '../../../../backend/node_modules/better-sqlite3'));
    }
}

function computeLedgerHash(item) {
    const effect = Number(item.effect_amount || 0).toFixed(4);
    const transDate = String(item.trans_date || '');
    const docNum = String(item.doc_number || '');
    const docType = String(item.doc_type || '');
    const total = Number(item.total_amount || 0).toFixed(4);
    const paid = Number(item.paid_amount || 0).toFixed(4);
    const rem = Number(item.remaining_amount || 0).toFixed(4);
    const runBal = Number(item.running_balance || 0).toFixed(4);
    const notes = String(item.notes || '');
    return `${effect}_${transDate}_${docNum}_${docType}_${total}_${paid}_${rem}_${runBal}_${notes}`;
}

function computePartyHash(p) {
    const code = p.code !== undefined && p.code !== null ? String(p.code) : '';
    const name = String(p.name || '');
    const phone = String(p.phone || '');
    const address = String(p.address || '');
    const type = String(p.type || '');
    const balance = Number(p.balance || 0).toFixed(4);
    return `${code}_${name}_${phone}_${address}_${type}_${balance}`;
}

class SyncEngine {
    constructor(options = {}) {
        this.accountingDb = options.accountingDb;
        this.storageDir = options.storageDir || path.resolve(__dirname, '../../../..');
        this.companyId = options.companyId;
        this.desktopVersion = options.desktopVersion || '9.2.10';
        this.edgeFunctionUrl = options.edgeFunctionUrl;
        this.keyStore = options.keyStore;
        
        this.stateDbPath = path.join(this.storageDir, 'sync_state.db');
        this.lockFilePath = path.join(this.storageDir, 'sync_engine.lock');
        this.acquireLock();
        this.initStateDb();
    }

    acquireLock() {
        fs.mkdirSync(this.storageDir, { recursive: true });
        if (fs.existsSync(this.lockFilePath)) {
            try {
                const content = fs.readFileSync(this.lockFilePath, 'utf8');
                const lockInfo = JSON.parse(content);
                if (lockInfo.pid && lockInfo.pid !== process.pid) {
                    let isAlive = false;
                    try {
                        process.kill(lockInfo.pid, 0);
                        isAlive = true;
                    } catch (_) {
                        isAlive = false;
                    }
                    if (isAlive) {
                        throw new Error('ENGINE_INSTANCE_ALREADY_RUNNING');
                    }
                }
            } catch (err) {
                if (err.message === 'ENGINE_INSTANCE_ALREADY_RUNNING') throw err;
            }
        }
        fs.writeFileSync(this.lockFilePath, JSON.stringify({
            pid: process.pid,
            startedAt: new Date().toISOString()
        }), 'utf8');
    }

    releaseLock() {
        if (fs.existsSync(this.lockFilePath)) {
            try {
                const content = fs.readFileSync(this.lockFilePath, 'utf8');
                const lockInfo = JSON.parse(content);
                if (lockInfo.pid === process.pid) {
                    fs.unlinkSync(this.lockFilePath);
                }
            } catch (_) {}
        }
    }

    initStateDb() {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.stateDb = new Database(this.stateDbPath);
        this.stateDb.pragma('journal_mode = WAL');

        this.stateDb.exec(`
            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS shadow_ledger (
                ledger_id INTEGER PRIMARY KEY,
                party_id INTEGER,
                amount REAL,
                trans_date TEXT,
                doc_number TEXT,
                doc_type TEXT,
                hash TEXT,
                synced_seq_no INTEGER,
                synced_at TEXT
            );

            CREATE TABLE IF NOT EXISTS shadow_parties (
                party_id INTEGER PRIMARY KEY,
                code TEXT,
                name TEXT,
                phone TEXT,
                address TEXT,
                type TEXT,
                balance REAL,
                hash TEXT,
                synced_seq_no INTEGER,
                synced_at TEXT
            );

            CREATE TABLE IF NOT EXISTS outbox_queue (
                seq_no INTEGER PRIMARY KEY,
                payload_json TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    close() {
        this.releaseLock();
        if (this.stateDb) {
            try { this.stateDb.close(); } catch (_) {}
        }
    }

    getNextSeqNo() {
        const outboxMax = this.stateDb.prepare("SELECT MAX(seq_no) as max_seq FROM outbox_queue").get();
        const metaRow = this.stateDb.prepare("SELECT value FROM sync_meta WHERE key = 'last_seq_no'").get();
        const metaSeq = metaRow ? Number(metaRow.value) : 0;
        const currentMax = Math.max(metaSeq, (outboxMax && outboxMax.max_seq) ? Number(outboxMax.max_seq) : 0);
        return currentMax + 1;
    }

    hasPendingOutbox() {
        const row = this.stateDb.prepare("SELECT count(*) as cnt FROM outbox_queue WHERE status = 'pending'").get();
        return Boolean(row && row.cnt > 0);
    }

    setLastSeqNo(seqNo) {
        this.stateDb.prepare(`
            INSERT INTO sync_meta (key, value) VALUES ('last_seq_no', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(String(seqNo));
    }

    // استخراج بيانات الأطراف وحركات دفتر الأستاذ دون المساس بقاعدة المحاسبة الأصلية
    extractCurrentProjection() {
        const partiesQuery = `
            SELECT 
                p.id,
                p.code,
                p.name,
                p.phone,
                p.address,
                p.type,
                COALESCE(b.balance, 0) AS balance
            FROM parties p
            LEFT JOIN (
                SELECT party_id, SUM(amount) AS balance
                FROM party_ledger
                GROUP BY party_id
            ) b ON b.party_id = p.id
            ORDER BY p.id ASC;
        `;
        let parties;

        const ledgerQuery = `
            SELECT 
                pl.id AS ledger_id,
                pl.party_id,
                pl.amount AS effect_amount,
                pl.transaction_date AS trans_date,
                pl.transaction_type,
                COALESCE(si.invoice_number, pi.invoice_number, tt.voucher_number, ls.document_number, 'OB-' || pl.party_id) AS doc_number,
                CASE 
                    WHEN pl.transaction_type IN ('sales_invoice', 'local_sale') THEN 'sales_invoice'
                    WHEN pl.transaction_type = 'purchase_invoice' THEN 'purchase_invoice'
                    WHEN pl.transaction_type = 'treasury_income' THEN 'voucher_receipt'
                    WHEN pl.transaction_type = 'treasury_expense' THEN 'voucher_payment'
                    WHEN pl.transaction_type = 'opening_balance' THEN 'opening_balance'
                    ELSE 'opening_balance'
                END AS doc_type,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN COALESCE(si.total_amount, 0)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN COALESCE(pi.total_amount, 0)
                    WHEN pl.transaction_type = 'local_sale' THEN COALESCE(ls.total, 0)
                    ELSE 0
                END AS total_amount,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN COALESCE(si.paid_amount, 0)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN COALESCE(pi.paid_amount, 0)
                    WHEN pl.transaction_type IN ('treasury_income', 'treasury_expense') THEN COALESCE(tt.amount, 0)
                    ELSE 0
                END AS paid_amount,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN COALESCE(si.remaining_amount, si.total_amount - si.paid_amount, 0)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN COALESCE(pi.remaining_amount, pi.total_amount - pi.paid_amount, 0)
                    WHEN pl.transaction_type = 'local_sale' THEN COALESCE(ls.total, 0)
                    ELSE 0
                END AS remaining_amount,
                COALESCE(NULLIF(pl.notes, ''), NULLIF(si.notes, ''), NULLIF(pi.notes, ''), NULLIF(tt.description, ''), NULLIF(ls.statement, ''), CASE WHEN pl.transaction_type = 'opening_balance' THEN 'رصيد افتتاحي' ELSE NULL END) AS notes
            FROM party_ledger pl
            LEFT JOIN sales_invoices si ON pl.transaction_type = 'sales_invoice' AND pl.reference_id = si.id
            LEFT JOIN purchase_invoices pi ON pl.transaction_type = 'purchase_invoice' AND pl.reference_id = pi.id
            LEFT JOIN treasury_transactions tt ON pl.transaction_type IN ('treasury_income', 'treasury_expense') AND pl.reference_id = tt.id
            LEFT JOIN local_sales ls ON pl.transaction_type = 'local_sale' AND pl.reference_id = ls.id
            ORDER BY pl.transaction_date ASC, pl.id ASC;
        `;
        let rawLedger;
        const readTx = this.accountingDb.transaction(() => {
            parties = this.accountingDb.prepare(partiesQuery).all();
            rawLedger = this.accountingDb.prepare(ledgerQuery).all();
        });
        readTx();

        // حساب الرصيد التراكمي بدقة لكل طرف
        const runningBalanceMap = {};
        const enrichedLedger = rawLedger.map(row => {
            const currentBal = (runningBalanceMap[row.party_id] || 0) + Number(row.effect_amount);
            runningBalanceMap[row.party_id] = currentBal;
            return {
                ...row,
                running_balance: currentBal.toFixed(4)
            };
        });

        return { parties, ledger: enrichedLedger };
    }

    computeFastDatabaseSignature() {
        try {
            const stats = this.accountingDb.prepare(`
                SELECT
                    (SELECT COUNT(*) FROM party_ledger) AS pl_cnt,
                    (SELECT MAX(id) FROM party_ledger) AS pl_max,
                    (SELECT COALESCE(SUM(amount), 0) FROM party_ledger) AS pl_sum,
                    (SELECT COUNT(*) FROM parties) AS p_cnt,
                    (SELECT MAX(id) FROM parties) AS p_max,
                    (SELECT COUNT(*) FROM sales_invoices) AS si_cnt,
                    (SELECT MAX(id) FROM sales_invoices) AS si_max,
                    (SELECT COALESCE(SUM(total_amount + paid_amount), 0) FROM sales_invoices) AS si_sum,
                    (SELECT COUNT(*) FROM purchase_invoices) AS pi_cnt,
                    (SELECT MAX(id) FROM purchase_invoices) AS pi_max,
                    (SELECT COALESCE(SUM(total_amount + paid_amount), 0) FROM purchase_invoices) AS pi_sum,
                    (SELECT COUNT(*) FROM treasury_transactions) AS tt_cnt,
                    (SELECT MAX(id) FROM treasury_transactions) AS tt_max
            `).get();

            return `${stats.pl_cnt}_${stats.pl_max}_${stats.pl_sum}_${stats.p_cnt}_${stats.p_max}_${stats.si_cnt}_${stats.si_max}_${stats.si_sum}_${stats.pi_cnt}_${stats.pi_max}_${stats.pi_sum}_${stats.tt_cnt}_${stats.tt_max}`;
        } catch (_) {
            return null;
        }
    }

    // رصد التغييرات التفاضلية (Delta) بمقارنة الحالة الحالية مع جدول الظل
    detectDeltaEvents(seqNo, force = false) {
        const currentSig = this.computeFastDatabaseSignature();
        if (!force && currentSig) {
            const metaRow = this.stateDb.prepare("SELECT value FROM sync_meta WHERE key = 'last_data_signature'").get();
            if (metaRow && metaRow.value === currentSig) {
                return { events: [], projection: null };
            }
        }

        const { parties, ledger } = this.extractCurrentProjection();
        const partyUpserts = [];
        const partyDeletes = [];
        const ledgerUpserts = [];
        const ledgerDeletes = [];

        const shadowPartyRows = this.stateDb.prepare('SELECT party_id, hash FROM shadow_parties').all();
        const shadowPartyMap = new Map();
        shadowPartyRows.forEach(r => shadowPartyMap.set(r.party_id, r));

        const activePartyIds = new Set();
        for (const p of parties) {
            activePartyIds.add(p.id);
            const partyHash = computePartyHash(p);
            const existingParty = shadowPartyMap.get(p.id);

            if (!existingParty || existingParty.hash !== partyHash) {
                partyUpserts.push({
                    entity_type: 'party',
                    action: 'UPSERT',
                    data: {
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        phone: p.phone,
                        address: p.address,
                        type: p.type,
                        balance: Number(p.balance).toFixed(4),
                        last_seq_no: seqNo
                    }
                });
            }
        }

        for (const [sPartyId] of shadowPartyMap.entries()) {
            if (!activePartyIds.has(sPartyId)) {
                partyDeletes.push({
                    entity_type: 'party',
                    action: 'DELETE',
                    party_id: sPartyId
                });
            }
        }

        const shadowRows = this.stateDb.prepare('SELECT ledger_id, hash, amount FROM shadow_ledger').all();
        const shadowMap = new Map();
        shadowRows.forEach(r => shadowMap.set(r.ledger_id, r));

        const activeLedgerIds = new Set();

        for (const line of ledger) {
            activeLedgerIds.add(line.ledger_id);
            const lineHash = computeLedgerHash(line);
            const existing = shadowMap.get(line.ledger_id);

            if (!existing || existing.hash !== lineHash) {
                ledgerUpserts.push({
                    entity_type: 'party_ledger',
                    action: 'UPSERT',
                    data: {
                        ledger_id: line.ledger_id,
                        party_id: line.party_id,
                        doc_type: line.doc_type,
                        doc_number: line.doc_number,
                        trans_date: line.trans_date,
                        total_amount: Number(line.total_amount).toFixed(4),
                        paid_amount: Number(line.paid_amount).toFixed(4),
                        remaining_amount: Number(line.remaining_amount).toFixed(4),
                        effect_amount: Number(line.effect_amount).toFixed(4),
                        running_balance: line.running_balance,
                        notes: line.notes || null,
                        seq_no: seqNo
                    }
                });
            }
        }

        for (const [sLedgerId] of shadowMap.entries()) {
            if (!activeLedgerIds.has(sLedgerId)) {
                ledgerDeletes.push({
                    entity_type: 'party_ledger',
                    action: 'DELETE',
                    ledger_id: sLedgerId
                });
            }
        }

        const events = [...partyUpserts, ...ledgerUpserts, ...ledgerDeletes, ...partyDeletes];
        if (events.length === 0 && currentSig) {
            this.stateDb.prepare(`
                INSERT INTO sync_meta (key, value) VALUES ('last_data_signature', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `).run(currentSig);
        }
        return { events, projection: { parties, ledger } };
    }

    commitShadowFromEvents(events, seqNo) {
        const insertLedgerStmt = this.stateDb.prepare(`
            INSERT INTO shadow_ledger (ledger_id, party_id, amount, trans_date, doc_number, doc_type, hash, synced_seq_no, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(ledger_id) DO UPDATE SET
                party_id = excluded.party_id,
                amount = excluded.amount,
                trans_date = excluded.trans_date,
                doc_number = excluded.doc_number,
                doc_type = excluded.doc_type,
                hash = excluded.hash,
                synced_seq_no = excluded.synced_seq_no,
                synced_at = excluded.synced_at
        `);

        const deleteLedgerStmt = this.stateDb.prepare('DELETE FROM shadow_ledger WHERE ledger_id = ?');

        const insertPartyStmt = this.stateDb.prepare(`
            INSERT INTO shadow_parties (party_id, code, name, phone, address, type, balance, hash, synced_seq_no, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(party_id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                phone = excluded.phone,
                address = excluded.address,
                type = excluded.type,
                balance = excluded.balance,
                hash = excluded.hash,
                synced_seq_no = excluded.synced_seq_no,
                synced_at = excluded.synced_at
        `);

        const deletePartyStmt = this.stateDb.prepare('DELETE FROM shadow_parties WHERE party_id = ?');

        this.stateDb.transaction(() => {
            for (const ev of events) {
                if (ev.entity_type === 'party_ledger') {
                    if (ev.action === 'UPSERT') {
                        const d = ev.data;
                        const hash = computeLedgerHash(d);
                        insertLedgerStmt.run(
                            d.ledger_id,
                            d.party_id,
                            Number(d.effect_amount),
                            d.trans_date,
                            d.doc_number,
                            d.doc_type,
                            hash,
                            seqNo
                        );
                    } else if (ev.action === 'DELETE') {
                        deleteLedgerStmt.run(ev.ledger_id);
                    }
                } else if (ev.entity_type === 'party') {
                    if (ev.action === 'UPSERT') {
                        const d = ev.data;
                        const hash = computePartyHash(d);
                        insertPartyStmt.run(
                            d.id,
                            d.code ? String(d.code) : null,
                            d.name,
                            d.phone,
                            d.address,
                            d.type,
                            Number(d.balance),
                            hash,
                            seqNo
                        );
                    } else if (ev.action === 'DELETE') {
                        deletePartyStmt.run(ev.party_id);
                    }
                }
            }
            this.setLastSeqNo(seqNo);
            const currentSig = this.computeFastDatabaseSignature();
            if (currentSig) {
                this.stateDb.prepare(`
                    INSERT INTO sync_meta (key, value) VALUES ('last_data_signature', ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                `).run(currentSig);
            }
        })();
    }

    commitShadowState(projection, seqNo) {
        const insertLedgerStmt = this.stateDb.prepare(`
            INSERT INTO shadow_ledger (ledger_id, party_id, amount, trans_date, doc_number, doc_type, hash, synced_seq_no, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(ledger_id) DO UPDATE SET
                party_id = excluded.party_id,
                amount = excluded.amount,
                trans_date = excluded.trans_date,
                doc_number = excluded.doc_number,
                doc_type = excluded.doc_type,
                hash = excluded.hash,
                synced_seq_no = excluded.synced_seq_no,
                synced_at = excluded.synced_at
        `);

        const deleteLedgerStmt = this.stateDb.prepare('DELETE FROM shadow_ledger WHERE ledger_id = ?');

        const insertPartyStmt = this.stateDb.prepare(`
            INSERT INTO shadow_parties (party_id, code, name, phone, address, type, balance, hash, synced_seq_no, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(party_id) DO UPDATE SET
                code = excluded.code,
                name = excluded.name,
                phone = excluded.phone,
                address = excluded.address,
                type = excluded.type,
                balance = excluded.balance,
                hash = excluded.hash,
                synced_seq_no = excluded.synced_seq_no,
                synced_at = excluded.synced_at
        `);

        const deletePartyStmt = this.stateDb.prepare('DELETE FROM shadow_parties WHERE party_id = ?');

        const activeIds = new Set();
        this.stateDb.transaction(() => {
            for (const line of projection.ledger) {
                activeIds.add(line.ledger_id);
                const hash = computeLedgerHash(line);
                insertLedgerStmt.run(
                    line.ledger_id,
                    line.party_id,
                    Number(line.effect_amount),
                    line.trans_date,
                    line.doc_number,
                    line.doc_type,
                    hash,
                    seqNo
                );
            }

            const existingShadow = this.stateDb.prepare('SELECT ledger_id FROM shadow_ledger').all();
            for (const row of existingShadow) {
                if (!activeIds.has(row.ledger_id)) {
                    deleteLedgerStmt.run(row.ledger_id);
                }
            }

            const activePartyIds = new Set();
            for (const p of projection.parties) {
                activePartyIds.add(p.id);
                const hash = computePartyHash(p);
                insertPartyStmt.run(
                    p.id,
                    p.code ? String(p.code) : null,
                    p.name,
                    p.phone,
                    p.address,
                    p.type,
                    Number(p.balance),
                    hash,
                    seqNo
                );
            }

            const existingShadowParties = this.stateDb.prepare('SELECT party_id FROM shadow_parties').all();
            for (const row of existingShadowParties) {
                if (!activePartyIds.has(row.party_id)) {
                    deletePartyStmt.run(row.party_id);
                }
            }

            this.setLastSeqNo(seqNo);
            const currentSig = this.computeFastDatabaseSignature();
            if (currentSig) {
                this.stateDb.prepare(`
                    INSERT INTO sync_meta (key, value) VALUES ('last_data_signature', ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                `).run(currentSig);
            }
        })();
    }

    queueDeltaBatch(seqNo, events, projection = null) {
        if (!events || events.length === 0) return null;
        const CHUNK_SIZE = 300;
        let curSeq = seqNo;

        for (let i = 0; i < events.length; i += CHUNK_SIZE) {
            const chunkEvents = events.slice(i, i + CHUNK_SIZE);
            chunkEvents.forEach(ev => {
                if (ev.data) ev.data.seq_no = curSeq;
            });
            const payload = {
                mode: 'delta_batch',
                batch_seq_no: curSeq,
                desktop_version: this.desktopVersion,
                events: chunkEvents
            };

            this.stateDb.prepare(`
                INSERT INTO outbox_queue (seq_no, payload_json, status)
                VALUES (?, ?, 'pending')
                ON CONFLICT(seq_no) DO UPDATE SET payload_json = excluded.payload_json
            `).run(curSeq, JSON.stringify(payload));

            curSeq++;
        }

        if (projection) {
            this._pendingProjections = this._pendingProjections || new Map();
            this._pendingProjections.set(curSeq - 1, projection);
        }

        return { mode: 'delta_batch', batch_seq_no: curSeq - 1, events_count: events.length };
    }

    async dispatchOutbox(transportFetch = null) {
        const pending = this.stateDb.prepare("SELECT seq_no, payload_json, retry_count FROM outbox_queue WHERE status = 'pending' ORDER BY seq_no ASC").all();
        if (pending.length === 0) return { processed: 0, pending: 0 };

        const fetchFn = transportFetch || fetch;
        let processedCount = 0;

        for (const item of pending) {
            try {
                const payload = JSON.parse(item.payload_json);
                const signed = this.keyStore.sign(item.payload_json);
                const res = await fetchFn(this.edgeFunctionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Device-Id': this.keyStore.deviceId,
                        'X-Timestamp': signed.timestamp,
                        'X-Nonce': signed.nonce,
                        'X-Signature': signed.signatureBase64
                    },
                    body: item.payload_json
                });

                let resJson = null;
                try {
                    resJson = await res.json();
                } catch (_) {}

                const isVerifiedSuccess = res.ok &&
                    resJson &&
                    (resJson.success === true || resJson.status === 'ok') &&
                    resJson.result &&
                    Number(resJson.result.batch_seq_no) === Number(item.seq_no);

                if (isVerifiedSuccess) {
                    this.stateDb.prepare("UPDATE outbox_queue SET status = 'synced' WHERE seq_no = ?").run(item.seq_no);

                    if (this._pendingProjections && this._pendingProjections.has(item.seq_no)) {
                        this.commitShadowState(this._pendingProjections.get(item.seq_no), item.seq_no);
                        this._pendingProjections.delete(item.seq_no);
                    } else if (payload.events && Array.isArray(payload.events)) {
                        this.commitShadowFromEvents(payload.events, item.seq_no);
                    } else {
                        this.setLastSeqNo(item.seq_no);
                    }
                    processedCount++;
                } else {
                    const errText = resJson ? JSON.stringify(resJson) : (await res.text().catch(() => 'HTTP Error'));
                    const newRetryCount = Number(item.retry_count || 0) + 1;
                    if (newRetryCount >= 5) {
                        this.stateDb.prepare("UPDATE outbox_queue SET status = 'failed', retry_count = ?, last_error = ? WHERE seq_no = ?").run(newRetryCount, errText, item.seq_no);
                        continue;
                    }
                    this.stateDb.prepare("UPDATE outbox_queue SET retry_count = ?, last_error = ? WHERE seq_no = ?").run(newRetryCount, errText, item.seq_no);
                    break;
                }
            } catch (netErr) {
                const newRetryCount = Number(item.retry_count || 0) + 1;
                this.stateDb.prepare("UPDATE outbox_queue SET retry_count = ?, last_error = ? WHERE seq_no = ?").run(newRetryCount, netErr.message, item.seq_no);
                break;
            }
        }

        const remaining = this.stateDb.prepare("SELECT count(*) as cnt FROM outbox_queue WHERE status = 'pending'").get().cnt;
        return { processed: processedCount, pending: remaining };
    }
}

module.exports = {
    SyncEngine
};
