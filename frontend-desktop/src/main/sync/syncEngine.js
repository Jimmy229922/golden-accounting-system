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
    const partyId = String(item.party_id || '');
    const effect = Number(item.effect_amount || 0).toFixed(4);
    const transDate = String(item.trans_date || '');
    const docNum = String(item.doc_number || '');
    const docType = String(item.doc_type || '');
    const total = Number(item.total_amount || 0).toFixed(4);
    const paid = Number(item.paid_amount || 0).toFixed(4);
    const rem = Number(item.remaining_amount || 0).toFixed(4);
    const runBal = Number(item.running_balance || 0).toFixed(4);
    const notes = String(item.notes || '');
    return `${partyId}_${effect}_${transDate}_${docNum}_${docType}_${total}_${paid}_${rem}_${runBal}_${notes}`;
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

function formatSyncEventsSummary(events) {
    if (!Array.isArray(events) || events.length === 0) {
        return 'تحديثات محاسبية تفاضلية';
    }

    const DOC_LABELS = {
        'purchase_invoice': 'فاتورة مشتريات',
        'sales_invoice': 'فاتورة مبيعات',
        'voucher_payment': 'سند صرف',
        'voucher_receipt': 'سند قبض',
        'opening_balance': 'رصيد افتتاحي',
        'local_sale': 'مبيعات نقدية'
    };

    const docTypes = [];
    const partyNames = [];

    for (const ev of events) {
        if (ev.entity_type === 'party' && ev.data && ev.data.name) {
            if (!partyNames.includes(ev.data.name)) partyNames.push(ev.data.name);
        } else if (ev.entity_type === 'party_ledger' && ev.data && ev.data.doc_type) {
            const label = DOC_LABELS[ev.data.doc_type] || ev.data.doc_type;
            if (!docTypes.includes(label)) docTypes.push(label);
        }
    }

    if (docTypes.length > 0 && partyNames.length > 0) {
        return `${docTypes.join('، ')}: ${partyNames.join('، ')}`;
    }

    if (docTypes.length > 0) {
        return docTypes.join('، ');
    }

    if (partyNames.length > 0) {
        return `تحديث بيانات: ${partyNames.join('، ')}`;
    }

    return 'تحديثات محاسبية تفاضلية';
}

class SyncEngine {
    constructor(options = {}) {
        this.accountingDb = options.accountingDb;
        this.storageDir = options.storageDir || path.resolve(__dirname, '../../../..');
        this.companyId = options.companyId;
        this.desktopVersion = options.desktopVersion || '10.1.0';
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

            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seq_no INTEGER,
                sync_type TEXT NOT NULL,
                status TEXT NOT NULL,
                events_count INTEGER DEFAULT 0,
                summary TEXT,
                error_text TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
        try {
            this.stateDb.prepare("UPDATE outbox_queue SET status = 'pending' WHERE status = 'failed'").run();
        } catch (_) {}

        try {
            this.stateDb.exec(`
                UPDATE sync_history SET summary = REPLACE(summary, 'purchase_invoice', 'فاتورة مشتريات') WHERE summary LIKE '%purchase_invoice%';
                UPDATE sync_history SET summary = REPLACE(summary, 'sales_invoice', 'فاتورة مبيعات') WHERE summary LIKE '%sales_invoice%';
                UPDATE sync_history SET summary = REPLACE(summary, 'voucher_payment', 'سند صرف') WHERE summary LIKE '%voucher_payment%';
                UPDATE sync_history SET summary = REPLACE(summary, 'voucher_receipt', 'سند قبض') WHERE summary LIKE '%voucher_receipt%';
                UPDATE sync_history SET summary = REPLACE(summary, 'opening_balance', 'رصيد افتتاحي') WHERE summary LIKE '%opening_balance%';
            `);
        } catch (_) {}

        try {
            const histRow = this.stateDb.prepare("SELECT count(*) as cnt FROM sync_history").get();
            if (!histRow || histRow.cnt === 0) {
                const existingOutbox = this.stateDb.prepare("SELECT seq_no, status, retry_count, last_error, created_at, payload_json FROM outbox_queue ORDER BY seq_no ASC").all();
                const insertHist = this.stateDb.prepare(`
                    INSERT INTO sync_history (seq_no, sync_type, status, events_count, summary, error_text, created_at)
                    VALUES (?, 'delta_batch', ?, ?, ?, ?, ?)
                `);
                existingOutbox.forEach(row => {
                    let eventsCount = 0;
                    let sampleInfo = '';
                    try {
                        const p = JSON.parse(row.payload_json);
                        if (Array.isArray(p.events)) {
                            eventsCount = p.events.length;
                            sampleInfo = formatSyncEventsSummary(p.events);
                        }
                    } catch (_) {}
                    insertHist.run(row.seq_no, row.status, eventsCount, sampleInfo || 'دفعة بيانات تفاضلية', row.last_error, row.created_at);
                });
            }
        } catch (_) {}
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

    getOrCreateStreamId() {
        try {
            const row = this.stateDb.prepare("SELECT value FROM sync_meta WHERE key = 'stream_id'").get();
            if (row && row.value && String(row.value).trim()) {
                return String(row.value).trim();
            }
            const crypto = require('crypto');
            const newStreamId = crypto.randomUUID();
            this.stateDb.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('stream_id', ?)").run(newStreamId);
            return newStreamId;
        } catch (_) {
            return null;
        }
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
                ROUND(COALESCE(b.balance, 0), 2) AS balance
            FROM parties p
            LEFT JOIN (
                SELECT party_id, ROUND(SUM(amount), 2) AS balance
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
                ROUND(pl.amount, 2) AS effect_amount,
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
                    WHEN pl.transaction_type = 'sales_invoice' THEN ROUND(COALESCE(si.total_amount, 0), 2)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN ROUND(COALESCE(pi.total_amount, 0), 2)
                    WHEN pl.transaction_type = 'local_sale' THEN ROUND(COALESCE(ls.total, 0), 2)
                    ELSE 0
                END AS total_amount,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN ROUND(COALESCE(si.paid_amount, 0), 2)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN ROUND(COALESCE(pi.paid_amount, 0), 2)
                    WHEN pl.transaction_type IN ('treasury_income', 'treasury_expense') THEN ROUND(COALESCE(tt.amount, 0), 2)
                    ELSE 0
                END AS paid_amount,
                CASE 
                    WHEN pl.transaction_type = 'sales_invoice' THEN ROUND(COALESCE(si.remaining_amount, si.total_amount - si.paid_amount, 0), 2)
                    WHEN pl.transaction_type = 'purchase_invoice' THEN ROUND(COALESCE(pi.remaining_amount, pi.total_amount - pi.paid_amount, 0), 2)
                    WHEN pl.transaction_type = 'local_sale' THEN ROUND(COALESCE(ls.total, 0), 2)
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
            const currentBal = Math.round(((runningBalanceMap[row.party_id] || 0) + Number(row.effect_amount)) * 100) / 100;
            runningBalanceMap[row.party_id] = currentBal;
            return {
                ...row,
                running_balance: currentBal.toFixed(2)
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
                    (SELECT COALESCE(SUM(LENGTH(name) + LENGTH(COALESCE(phone, '')) + LENGTH(COALESCE(address, '')) + COALESCE(code, 0) + COALESCE(balance, 0)), 0) FROM parties) AS p_content_sum,
                    (SELECT COUNT(*) FROM sales_invoices) AS si_cnt,
                    (SELECT MAX(id) FROM sales_invoices) AS si_max,
                    (SELECT COALESCE(SUM(total_amount + paid_amount), 0) FROM sales_invoices) AS si_sum,
                    (SELECT COUNT(*) FROM purchase_invoices) AS pi_cnt,
                    (SELECT MAX(id) FROM purchase_invoices) AS pi_max,
                    (SELECT COALESCE(SUM(total_amount + paid_amount), 0) FROM purchase_invoices) AS pi_sum,
                    (SELECT COUNT(*) FROM treasury_transactions) AS tt_cnt,
                    (SELECT MAX(id) FROM treasury_transactions) AS tt_max,
                    (SELECT COUNT(*) FROM local_sales) AS ls_cnt,
                    (SELECT MAX(id) FROM local_sales) AS ls_max,
                    (SELECT COALESCE(SUM(total), 0) FROM local_sales) AS ls_sum
            `).get();

            return `${stats.pl_cnt}_${stats.pl_max}_${stats.pl_sum}_${stats.p_cnt}_${stats.p_max}_${stats.p_content_sum}_${stats.si_cnt}_${stats.si_max}_${stats.si_sum}_${stats.pi_cnt}_${stats.pi_max}_${stats.pi_sum}_${stats.tt_cnt}_${stats.tt_max}_${stats.ls_cnt}_${stats.ls_max}_${stats.ls_sum}`;
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
                stream_id: this.getOrCreateStreamId(),
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
        if (pending.length === 0) return { processed: 0, pending: 0, lastError: null };

        const fetchFn = transportFetch || fetch;
        let processedCount = 0;
        let lastError = null;

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

                if (resJson && resJson.server_time) {
                    try {
                        const { setServerTimeOffset } = require('./secureKeyStore');
                        setServerTimeOffset(resJson.server_time);
                    } catch (_) {}
                }

                const resultObj = resJson ? (resJson.result || resJson) : null;
                const resultStatus = resultObj ? resultObj.status : null;
                const isAlreadyApplied = resultStatus === 'already_applied';
                const isResyncRequired = resultStatus === 'resync_required';

                const isVerifiedSuccess = ((res.ok &&
                    resJson &&
                    (resJson.success === true || resJson.status === 'ok') &&
                    resultObj &&
                    Number(resultObj.batch_seq_no) === Number(item.seq_no)) || isAlreadyApplied) &&
                    !isResyncRequired;

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

                    const sampleInfo = (payload.events && Array.isArray(payload.events))
                        ? formatSyncEventsSummary(payload.events)
                        : 'تم رفع الدفعة بنجاح';
                    this.logSyncHistory({
                        seq_no: item.seq_no,
                        sync_type: 'delta_batch',
                        status: 'synced',
                        events_count: (payload.events && Array.isArray(payload.events)) ? payload.events.length : 0,
                        summary: sampleInfo
                    });

                    processedCount++;
                } else if (isResyncRequired) {
                    const expectedSeq = Number((resultObj && resultObj.expected_seq) || (Number(item.seq_no) + 1));
                    this.stateDb.prepare("DELETE FROM outbox_queue WHERE status = 'pending'").run();
                    this.setLastSeqNo(expectedSeq - 1);
                    this.stateDb.prepare("DELETE FROM shadow_parties").run();
                    this.stateDb.prepare("DELETE FROM shadow_ledger").run();
                    this.stateDb.prepare("DELETE FROM sync_meta WHERE key = 'last_data_signature'").run();
                    if (this._pendingProjections) {
                        this._pendingProjections.clear();
                    }
                    this.logSyncHistory({
                        seq_no: item.seq_no,
                        sync_type: 'delta_batch',
                        status: 'failed',
                        events_count: (payload.events && Array.isArray(payload.events)) ? payload.events.length : 0,
                        summary: 'طلب السيرفر إعادة مطابقة التسلسل، جاري رفع لقطة كاملة'
                    });
                    break;
                } else {
                    const errText = resJson ? (resJson.error || JSON.stringify(resJson)) : (await res.text().catch(() => 'HTTP Error ' + res.status));
                    lastError = errText;
                    const newRetryCount = Number(item.retry_count || 0) + 1;

                    this.logSyncHistory({
                        seq_no: item.seq_no,
                        sync_type: 'delta_batch',
                        status: 'failed',
                        events_count: (payload.events && Array.isArray(payload.events)) ? payload.events.length : 0,
                        summary: 'تعثر إرسال الدفعة للسحابة',
                        error_text: errText
                    });

                    if (typeof errText === 'string' && (errText.includes('stream_conflict') || resultStatus === 'stream_conflict')) {
                        const rebound = await this.rebindStreamWithCloud();
                        if (rebound && rebound.success) {
                            this.stateDb.prepare("DELETE FROM outbox_queue WHERE status = 'pending'").run();
                            this.setLastSeqNo(0);
                            this.stateDb.prepare("DELETE FROM shadow_parties").run();
                            this.stateDb.prepare("DELETE FROM shadow_ledger").run();
                            this.stateDb.prepare("DELETE FROM sync_meta WHERE key = 'last_data_signature'").run();
                            break;
                        }
                    }

                    if (typeof errText === 'string' && errText.includes('Sequence conflict: Expected')) {
                        const match = errText.match(/Expected\s+(\d+)/i);
                        if (match && match[1]) {
                            const expectedSeq = Number(match[1]);
                            this.stateDb.prepare("DELETE FROM outbox_queue WHERE seq_no >= ?").run(expectedSeq);
                            this.setLastSeqNo(expectedSeq - 1);
                            this.stateDb.prepare("DELETE FROM shadow_parties").run();
                            this.stateDb.prepare("DELETE FROM shadow_ledger").run();
                            this.stateDb.prepare("DELETE FROM sync_meta WHERE key = 'last_data_signature'").run();
                            break;
                        }
                    }

                    if (newRetryCount >= 8) {
                        this.stateDb.prepare("UPDATE outbox_queue SET status = 'dead', last_error = ? WHERE seq_no = ?").run(errText, item.seq_no);
                        this.stateDb.prepare("DELETE FROM shadow_parties").run();
                        this.stateDb.prepare("DELETE FROM shadow_ledger").run();
                        this.stateDb.prepare("DELETE FROM sync_meta WHERE key = 'last_data_signature'").run();
                    } else {
                        this.stateDb.prepare("UPDATE outbox_queue SET retry_count = ?, last_error = ? WHERE seq_no = ?").run(newRetryCount, errText, item.seq_no);
                    }
                    break;
                }
            } catch (netErr) {
                lastError = netErr.message;
                const newRetryCount = Number(item.retry_count || 0) + 1;
                this.stateDb.prepare("UPDATE outbox_queue SET retry_count = ?, last_error = ? WHERE seq_no = ?").run(newRetryCount, netErr.message, item.seq_no);
                let evCount = 0;
                try {
                    const p = JSON.parse(item.payload_json);
                    if (p.events && Array.isArray(p.events)) evCount = p.events.length;
                } catch (_) {}
                this.logSyncHistory({
                    seq_no: item.seq_no,
                    sync_type: 'delta_batch',
                    status: 'failed',
                    events_count: evCount,
                    summary: 'تعثر إرسال الدفعة (انقطاع الاتصال بالسحابة)',
                    error_text: netErr.message
                });
                break;
            }
        }

        const remaining = this.stateDb.prepare("SELECT count(*) as cnt FROM outbox_queue WHERE status = 'pending'").get().cnt;
        return { processed: processedCount, pending: remaining, lastError };
    }

    logSyncHistory(entry) {
        try {
            this.stateDb.prepare(`
                INSERT INTO sync_history (seq_no, sync_type, status, events_count, summary, error_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
            `).run(
                entry.seq_no || null,
                entry.sync_type || 'auto',
                entry.status || 'synced',
                Number(entry.events_count || 0),
                entry.summary || null,
                entry.error_text || null
            );
            this.stateDb.prepare(`
                DELETE FROM sync_history WHERE id NOT IN (
                    SELECT id FROM sync_history ORDER BY id DESC LIMIT 100
                )
            `).run();
        } catch (_) {}
    }

    logPeriodicSyncCheck(isManual = false, success = true, errorText = null) {
        try {
            const nextSeq = this.getNextSeqNo();
            this.logSyncHistory({
                seq_no: nextSeq > 1 ? nextSeq - 1 : 1,
                sync_type: isManual ? 'manual_check' : 'auto_idle',
                status: isManual ? (success ? 'synced' : 'failed') : (success ? 'idle' : 'failed'),
                events_count: 0,
                summary: isManual
                    ? (success ? 'مزامنة فورية: تم فحص وتأكيد مطابقة البيانات مع السحابة' : 'مزامنة فورية: تعذر الاتصال بالسحابة')
                    : (success ? 'فحص دوري: لم يتم الرفع لعدم وجود تغييرات في البرنامج' : 'مزامنة دورية: تعذر الاتصال بالسحابة'),
                error_text: errorText
            });
        } catch (_) {}
    }

    logManualSyncCheck(success = true, errorText = null) {
        return this.logPeriodicSyncCheck(true, success, errorText);
    }

    async pingHeartbeat() {
        if (!this.keyStore || !this.edgeFunctionUrl) return { ok: true };
        const payload = {
            mode: 'heartbeat',
            desktop_version: this.desktopVersion
        };
        const bodyStr = JSON.stringify(payload);
        const signed = this.keyStore.sign(bodyStr);
        const res = await fetch(this.edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Id': this.keyStore.deviceId,
                'X-Timestamp': signed.timestamp,
                'X-Nonce': signed.nonce,
                'X-Signature': signed.signatureBase64
            },
            body: bodyStr,
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => 'HTTP Error ' + res.status);
            throw new Error(errText || ('HTTP ' + res.status));
        }
        const resJson = await res.json().catch(() => null);
        if (resJson && resJson.server_time) {
            try {
                const { setServerTimeOffset } = require('./secureKeyStore');
                setServerTimeOffset(resJson.server_time);
            } catch (_) {}
        }
        return resJson || { status: 'ok' };
    }

    async reconcileWithCloud() {
        if (!this.keyStore || !this.edgeFunctionUrl) return null;
        try {
            const parties = this.accountingDb.prepare("SELECT id FROM parties").all();
            const partyIds = parties.map(p => Number(p.id));
            const ledger = this.accountingDb.prepare("SELECT id FROM party_ledger").all();
            const ledgerIds = ledger.map(l => Number(l.id));

            const payload = {
                mode: 'reconcile_ids',
                party_ids: partyIds,
                ledger_ids: ledgerIds,
                expected_parties_count: partyIds.length,
                expected_ledger_count: ledgerIds.length
            };
            const bodyStr = JSON.stringify(payload);
            const signed = this.keyStore.sign(bodyStr);
            const res = await fetch(this.edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': this.keyStore.deviceId,
                    'X-Timestamp': signed.timestamp,
                    'X-Nonce': signed.nonce,
                    'X-Signature': signed.signatureBase64
                },
                body: bodyStr,
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) return null;
            return await res.json().catch(() => null);
        } catch (_) {
            return null;
        }
    }

    async rebindStreamWithCloud() {
        if (!this.keyStore || !this.edgeFunctionUrl) return null;
        try {
            const newStreamId = this.getStreamId();
            const payload = {
                mode: 'rebind_stream',
                new_stream_id: newStreamId
            };
            const bodyStr = JSON.stringify(payload);
            const signed = this.keyStore.sign(bodyStr);
            const res = await fetch(this.edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': this.keyStore.deviceId,
                    'X-Timestamp': signed.timestamp,
                    'X-Nonce': signed.nonce,
                    'X-Signature': signed.signatureBase64
                },
                body: bodyStr,
                signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) return null;
            return await res.json().catch(() => null);
        } catch (_) {
            return null;
        }
    }

    getSyncDiagnostics() {
        try {
            const countsRows = this.stateDb.prepare("SELECT status, count(*) as cnt FROM outbox_queue GROUP BY status").all();
            const counts = { synced: 0, pending: 0, failed: 0, total: 0 };
            countsRows.forEach(r => {
                counts[r.status] = r.cnt;
                counts.total += r.cnt;
            });

            const shadowParties = this.stateDb.prepare("SELECT count(*) as cnt FROM shadow_parties").get().cnt;
            const shadowLedger = this.stateDb.prepare("SELECT count(*) as cnt FROM shadow_ledger").get().cnt;

            const metaRows = this.stateDb.prepare("SELECT key, value FROM sync_meta").all();
            const meta = {};
            metaRows.forEach(r => { meta[r.key] = r.value; });

            let recentRows = this.stateDb.prepare("SELECT id, seq_no, sync_type, status, events_count, summary, error_text, created_at FROM sync_history ORDER BY id DESC LIMIT 30").all();
            if (recentRows.length === 0) {
                const outboxRows = this.stateDb.prepare("SELECT seq_no, payload_json, status, retry_count, last_error, created_at FROM outbox_queue ORDER BY seq_no DESC LIMIT 30").all();
                recentRows = outboxRows.map(r => {
                    let evCount = 0;
                    let summaryText = 'تحديثات محاسبية تفاضلية';
                    try {
                        const p = JSON.parse(r.payload_json);
                        if (p.events && Array.isArray(p.events)) {
                            evCount = p.events.length;
                            summaryText = formatSyncEventsSummary(p.events);
                        }
                    } catch (_) {}
                    return {
                        id: r.seq_no,
                        seq_no: r.seq_no,
                        sync_type: 'delta_batch',
                        status: r.status,
                        events_count: evCount,
                        summary: summaryText,
                        error_text: r.last_error,
                        created_at: r.created_at
                    };
                });
            }
            const recentBatches = recentRows.map(r => ({
                id: r.id,
                seq_no: r.seq_no,
                sync_type: r.sync_type,
                status: r.status,
                retry_count: 0,
                last_error: r.error_text,
                created_at: r.created_at,
                events_count: r.events_count,
                sample_info: r.summary
            }));

            return {
                deviceId: this.keyStore ? this.keyStore.deviceId : null,
                companyId: this.companyId,
                desktopVersion: this.desktopVersion,
                counts,
                shadowCounts: {
                    parties: shadowParties,
                    ledger: shadowLedger
                },
                meta,
                recentBatches
            };
        } catch (e) {
            return { error: e.message };
        }
    }
}

module.exports = {
    SyncEngine
};
