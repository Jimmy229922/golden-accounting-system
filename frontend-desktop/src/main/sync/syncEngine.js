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

class SyncEngine {
    constructor(options = {}) {
        this.accountingDb = options.accountingDb;
        this.storageDir = options.storageDir || path.resolve(__dirname, '../../../..');
        this.companyId = options.companyId;
        this.desktopVersion = options.desktopVersion || '9.2.0';
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
        const row = this.stateDb.prepare("SELECT value FROM sync_meta WHERE key = 'last_seq_no'").get();
        const current = row ? Number(row.value) : 100;
        return current + 1;
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
                COALESCE((SELECT SUM(amount) FROM party_ledger WHERE party_id = p.id), 0) AS balance
            FROM parties p
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
                    WHEN pl.transaction_type = 'sales_invoice' THEN 'sales_invoice'
                    WHEN pl.transaction_type = 'purchase_invoice' THEN 'purchase_invoice'
                    WHEN pl.transaction_type = 'treasury_income' THEN 'voucher_receipt'
                    WHEN pl.transaction_type = 'treasury_expense' THEN 'voucher_payment'
                    WHEN pl.transaction_type = 'opening_balance' THEN 'opening_balance'
                    ELSE 'opening_balance'
                END AS doc_type,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN COALESCE(si.total_amount, 0)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN COALESCE(pi.total_amount, 0)
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
                    ELSE 0
                END AS remaining_amount
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

    // رصد التغييرات التفاضلية (Delta) بمقارنة الحالة الحالية مع جدول الظل
    detectDeltaEvents(seqNo) {
        const { parties, ledger } = this.extractCurrentProjection();
        const events = [];

        const shadowRows = this.stateDb.prepare('SELECT ledger_id, hash, amount FROM shadow_ledger').all();
        const shadowMap = new Map();
        shadowRows.forEach(r => shadowMap.set(r.ledger_id, r));

        const activeLedgerIds = new Set();

        for (const line of ledger) {
            activeLedgerIds.add(line.ledger_id);
            const lineHash = `${line.effect_amount}_${line.trans_date}_${line.doc_number}_${line.doc_type}_${line.total_amount}_${line.paid_amount}_${line.remaining_amount}_${line.running_balance}`;
            const existing = shadowMap.get(line.ledger_id);

            if (!existing || existing.hash !== lineHash) {
                events.push({
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
                        seq_no: seqNo
                    }
                });
            }
        }

        // رصد الحركات المحذوفة
        for (const [sLedgerId] of shadowMap.entries()) {
            if (!activeLedgerIds.has(sLedgerId)) {
                events.push({
                    entity_type: 'party_ledger',
                    action: 'DELETE',
                    ledger_id: sLedgerId
                });
            }
        }

        const shadowPartyRows = this.stateDb.prepare('SELECT party_id, hash FROM shadow_parties').all();
        const shadowPartyMap = new Map();
        shadowPartyRows.forEach(r => shadowPartyMap.set(r.party_id, r));

        const activePartyIds = new Set();
        for (const p of parties) {
            activePartyIds.add(p.id);
            const partyHash = `${p.code ?? ''}_${p.name ?? ''}_${p.phone ?? ''}_${p.address ?? ''}_${p.type ?? ''}_${Number(p.balance).toFixed(4)}`;
            const existingParty = shadowPartyMap.get(p.id);

            if (!existingParty || existingParty.hash !== partyHash) {
                events.push({
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
                events.push({
                    entity_type: 'party',
                    action: 'DELETE',
                    party_id: sPartyId
                });
            }
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
                        const hash = `${d.effect_amount}_${d.trans_date}_${d.doc_number}_${d.doc_type}_${d.total_amount}_${d.paid_amount}_${d.remaining_amount}_${d.running_balance}`;
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
                        const hash = `${d.code ?? ''}_${d.name ?? ''}_${d.phone ?? ''}_${d.address ?? ''}_${d.type ?? ''}_${Number(d.balance).toFixed(4)}`;
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
                const hash = `${line.effect_amount}_${line.trans_date}_${line.doc_number}_${line.doc_type}_${line.total_amount}_${line.paid_amount}_${line.remaining_amount}_${line.running_balance}`;
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
                const hash = `${p.code ?? ''}_${p.name ?? ''}_${p.phone ?? ''}_${p.address ?? ''}_${p.type ?? ''}_${Number(p.balance).toFixed(4)}`;
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
        })();
    }

    queueDeltaBatch(seqNo, events, projection = null) {
        const payload = {
            mode: 'delta_batch',
            batch_seq_no: seqNo,
            desktop_version: this.desktopVersion,
            events
        };

        this.stateDb.prepare(`
            INSERT INTO outbox_queue (seq_no, payload_json, status)
            VALUES (?, ?, 'pending')
            ON CONFLICT(seq_no) DO UPDATE SET payload_json = excluded.payload_json
        `).run(seqNo, JSON.stringify(payload));

        if (projection) {
            this._pendingProjections = this._pendingProjections || new Map();
            this._pendingProjections.set(seqNo, projection);
        }

        return payload;
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
                    this.stateDb.prepare("UPDATE outbox_queue SET retry_count = retry_count + 1, last_error = ? WHERE seq_no = ?").run(errText, item.seq_no);
                    break;
                }
            } catch (netErr) {
                this.stateDb.prepare("UPDATE outbox_queue SET retry_count = retry_count + 1, last_error = ? WHERE seq_no = ?").run(netErr.message, item.seq_no);
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
