const { ipcMain } = require('electron');
const { db } = require('../db');

const ATTENDANCE_DAYS = [
    'saturday',
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday'
];
const ALLOWED_DURATIONS = new Set([0, 0.5, 1, 1.5]);

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseIsoDate(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

    const date = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
        return null;
    }

    return { text, date };
}

function normalizeWeekStart(value) {
    const parsed = parseIsoDate(value);
    if (!parsed) {
        throw new Error('تاريخ بداية الأسبوع غير صحيح');
    }

    if (parsed.date.getUTCDay() !== 6) {
        throw new Error('بداية الأسبوع يجب أن تكون يوم السبت');
    }

    return parsed.text;
}

function getWeekEnd(weekStart) {
    const parsed = parseIsoDate(weekStart);
    const date = parsed.date;
    date.setUTCDate(date.getUTCDate() + 6);
    return date.toISOString().slice(0, 10);
}

function normalizeWorkerPayload(data = {}) {
    const name = String(data.name || '').trim();
    const dailyWage = roundMoney(data.daily_wage);
    const jobTitle = String(data.job_title || '').trim();
    const notes = String(data.notes || '').trim();

    if (!name) {
        throw new Error('اسم العامل مطلوب');
    }

    if (!Number.isFinite(Number(data.daily_wage)) || dailyWage <= 0) {
        throw new Error('الأجر اليومي يجب أن يكون أكبر من صفر');
    }

    if (!jobTitle) {
        throw new Error('الوظيفة مطلوبة');
    }

    return {
        name,
        daily_wage: dailyWage,
        job_title: jobTitle,
        notes
    };
}

function normalizeAttendanceEntry(entry = {}) {
    const workerId = Number(entry.worker_id);
    if (!Number.isInteger(workerId) || workerId <= 0) {
        throw new Error('معرف العامل غير صحيح');
    }

    const normalized = { worker_id: workerId };
    for (const day of ATTENDANCE_DAYS) {
        const present = entry[`${day}_present`] ? 1 : 0;
        const duration = present ? Number(entry[`${day}_duration`]) : 0;

        if (present && !ALLOWED_DURATIONS.has(duration)) {
            throw new Error('مدة العمل يجب أن تكون نصف يوم أو يومًا أو يومًا ونصف أو بدون إضافي');
        }

        normalized[`${day}_present`] = present;
        normalized[`${day}_duration`] = present ? duration : 0;
    }

    return normalized;
}

function normalizeAdvancePayload(data = {}) {
    const workerId = Number(data.worker_id);
    const weekStart = normalizeWeekStart(data.week_start_date);
    const parsedAdvanceDate = parseIsoDate(data.advance_date);
    const amount = roundMoney(data.amount);

    if (!Number.isInteger(workerId) || workerId <= 0) {
        throw new Error('معرف العامل غير صحيح');
    }

    if (!parsedAdvanceDate) {
        throw new Error('تاريخ السلفة غير صحيح');
    }

    const weekEnd = getWeekEnd(weekStart);
    if (parsedAdvanceDate.text < weekStart || parsedAdvanceDate.text > weekEnd) {
        throw new Error('تاريخ السلفة يجب أن يكون داخل الأسبوع المحدد');
    }

    if (!Number.isFinite(Number(data.amount)) || amount <= 0) {
        throw new Error('مبلغ السلفة يجب أن يكون أكبر من صفر');
    }

    return {
        worker_id: workerId,
        week_start_date: weekStart,
        advance_date: parsedAdvanceDate.text,
        amount,
        notes: String(data.notes || '').trim()
    };
}

function getWeekData(weekStart, includeArchived = false) {
    const workers = db.prepare(`
        SELECT
            w.id AS worker_id,
            w.name,
            w.daily_wage,
            w.job_title,
            w.notes,
            w.is_active,
            (SELECT COALESCE(SUM(amount), 0) FROM worker_advances WHERE worker_id = w.id) AS historical_advances_total,
            a.id AS attendance_id,
            a.daily_wage AS week_daily_wage,
            a.saturday_present,
            a.saturday_duration,
            a.sunday_present,
            a.sunday_duration,
            a.monday_present,
            a.monday_duration,
            a.tuesday_present,
            a.tuesday_duration,
            a.wednesday_present,
            a.wednesday_duration,
            a.thursday_present,
            a.thursday_duration,
            a.friday_present,
            a.friday_duration
        FROM workers w
        LEFT JOIN worker_weekly_attendance a
            ON a.worker_id = w.id
           AND a.week_start_date = @week_start_date
        WHERE (@include_archived = 0 AND w.is_active = 1)
           OR (@include_archived = 1 AND w.is_active = 0)
        ORDER BY w.is_active DESC, w.name COLLATE NOCASE ASC, w.id ASC
    `).all({
        week_start_date: weekStart,
        include_archived: includeArchived ? 1 : 0
    });

    const advances = db.prepare(`
        SELECT id, worker_id, week_start_date, advance_date, amount, notes, created_at, updated_at
        FROM worker_advances
        WHERE week_start_date = ?
        ORDER BY advance_date ASC, id ASC
    `).all(weekStart);

    const advancesByWorker = new Map();
    for (const advance of advances) {
        const workerAdvances = advancesByWorker.get(advance.worker_id) || [];
        workerAdvances.push({
            ...advance,
            amount: roundMoney(advance.amount)
        });
        advancesByWorker.set(advance.worker_id, workerAdvances);
    }

    const isNewLogic = weekStart >= '2026-07-11';
    const rows = workers.map((worker) => {
        const attendance = {};
        let attendanceUnits = 0;

        for (const day of ATTENDANCE_DAYS) {
            const present = Boolean(worker[`${day}_present`]);
            const defaultDuration = isNewLogic ? 0 : 1;
            const duration = present && ALLOWED_DURATIONS.has(Number(worker[`${day}_duration`]))
                ? Number(worker[`${day}_duration`])
                : (present ? defaultDuration : 0);

            attendance[day] = { present, duration };
            attendanceUnits += present ? (isNewLogic ? (1 + duration) : duration) : 0;
        }

        const dailyWage = worker.attendance_id
            ? roundMoney(worker.week_daily_wage)
            : roundMoney(worker.daily_wage);
        const workerAdvances = advancesByWorker.get(worker.worker_id) || [];
        const advancesTotal = roundMoney(workerAdvances.reduce((sum, item) => sum + Number(item.amount || 0), 0));
        const grossPay = roundMoney(dailyWage * attendanceUnits);

        return {
            id: worker.worker_id,
            name: worker.name,
            daily_wage: dailyWage,
            current_daily_wage: roundMoney(worker.daily_wage),
            job_title: worker.job_title,
            notes: worker.notes || '',
            is_active: Boolean(worker.is_active),
            has_attendance_record: Boolean(worker.attendance_id),
            attendance,
            attendance_units: attendanceUnits,
            gross_pay: grossPay,
            advances_total: advancesTotal,
            net_pay: roundMoney(grossPay - advancesTotal),
            advances: workerAdvances,
            historical_advances_total: roundMoney(worker.historical_advances_total || 0)
        };
    });

    const totals = rows.reduce((summary, row) => {
        summary.gross_pay = roundMoney(summary.gross_pay + row.gross_pay);
        summary.advances_total = roundMoney(summary.advances_total + row.advances_total);
        summary.net_pay = roundMoney(summary.net_pay + row.net_pay);
        return summary;
    }, {
        workers_count: rows.length,
        gross_pay: 0,
        advances_total: 0,
        net_pay: 0
    });

    return {
        week_start_date: weekStart,
        week_end_date: getWeekEnd(weekStart),
        rows,
        totals
    };
}

function register() {
    ipcMain.handle('get-workers-management-week', (event, params = {}) => {
        try {
            const weekStart = normalizeWeekStart(params.week_start_date);
            return {
                success: true,
                ...getWeekData(weekStart, Boolean(params.include_archived))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-workers-management-weeks', () => {
        try {
            const rows = db.prepare(`
                SELECT week_start_date
                FROM (
                    SELECT week_start_date FROM worker_weekly_attendance
                    UNION
                    SELECT week_start_date FROM worker_advances
                )
                ORDER BY week_start_date DESC
                LIMIT 260
            `).all();

            return {
                success: true,
                weeks: rows.map((row) => row.week_start_date)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-worker', (event, data = {}) => {
        try {
            const payload = normalizeWorkerPayload(data);
            const info = db.prepare(`
                INSERT INTO workers (name, daily_wage, job_title, notes)
                VALUES (@name, @daily_wage, @job_title, @notes)
            `).run(payload);

            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-worker', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!Number.isInteger(id) || id <= 0) {
                return { success: false, error: 'معرف العامل غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM workers WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'العامل غير موجود' };
            }

            const payload = normalizeWorkerPayload(data);
            const updateTransaction = db.transaction(() => {
                db.prepare(`
                    UPDATE workers
                    SET name = @name,
                        daily_wage = @daily_wage,
                        job_title = @job_title,
                        notes = @notes,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id
                `).run({ ...payload, id });

                db.prepare(`
                    UPDATE worker_weekly_attendance
                    SET daily_wage = @daily_wage
                    WHERE worker_id = @id
                      AND week_start_date >= '2026-07-11'
                `).run({ daily_wage: payload.daily_wage, id });
            });

            updateTransaction();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('archive-worker', (event, idValue) => {
        try {
            const id = Number(idValue);
            if (!Number.isInteger(id) || id <= 0) {
                return { success: false, error: 'معرف العامل غير صحيح' };
            }

            const info = db.prepare(`
                UPDATE workers
                SET is_active = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND is_active = 1
            `).run(id);

            if (!info.changes) {
                return { success: false, error: 'العامل غير موجود أو مؤرشف بالفعل' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('restore-worker', (event, idValue) => {
        try {
            const id = Number(idValue);
            if (!Number.isInteger(id) || id <= 0) {
                return { success: false, error: 'معرف العامل غير صحيح' };
            }

            const info = db.prepare(`
                UPDATE workers
                SET is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND is_active = 0
            `).run(id);

            if (!info.changes) {
                return { success: false, error: 'العامل غير موجود أو نشط بالفعل' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-workers-week-attendance', (event, data = {}) => {
        try {
            const weekStart = normalizeWeekStart(data.week_start_date);
            const entries = Array.isArray(data.entries) ? data.entries : [];
            const normalizedEntries = entries.map(normalizeAttendanceEntry);
            const getWorker = db.prepare('SELECT id, daily_wage FROM workers WHERE id = ?');
            const getExisting = db.prepare(`
                SELECT daily_wage
                FROM worker_weekly_attendance
                WHERE worker_id = ? AND week_start_date = ?
            `);
            const upsertAttendance = db.prepare(`
                INSERT INTO worker_weekly_attendance (
                    worker_id, week_start_date, daily_wage,
                    saturday_present, saturday_duration,
                    sunday_present, sunday_duration,
                    monday_present, monday_duration,
                    tuesday_present, tuesday_duration,
                    wednesday_present, wednesday_duration,
                    thursday_present, thursday_duration,
                    friday_present, friday_duration
                ) VALUES (
                    @worker_id, @week_start_date, @daily_wage,
                    @saturday_present, @saturday_duration,
                    @sunday_present, @sunday_duration,
                    @monday_present, @monday_duration,
                    @tuesday_present, @tuesday_duration,
                    @wednesday_present, @wednesday_duration,
                    @thursday_present, @thursday_duration,
                    @friday_present, @friday_duration
                )
                ON CONFLICT(worker_id, week_start_date) DO UPDATE SET
                    saturday_present = excluded.saturday_present,
                    saturday_duration = excluded.saturday_duration,
                    sunday_present = excluded.sunday_present,
                    sunday_duration = excluded.sunday_duration,
                    monday_present = excluded.monday_present,
                    monday_duration = excluded.monday_duration,
                    tuesday_present = excluded.tuesday_present,
                    tuesday_duration = excluded.tuesday_duration,
                    wednesday_present = excluded.wednesday_present,
                    wednesday_duration = excluded.wednesday_duration,
                    thursday_present = excluded.thursday_present,
                    thursday_duration = excluded.thursday_duration,
                    friday_present = excluded.friday_present,
                    friday_duration = excluded.friday_duration,
                    updated_at = CURRENT_TIMESTAMP
            `);

            const saveTransaction = db.transaction(() => {
                for (const entry of normalizedEntries) {
                    const worker = getWorker.get(entry.worker_id);
                    if (!worker) {
                        throw new Error('تعذر العثور على أحد العمال');
                    }

                    const existing = getExisting.get(entry.worker_id, weekStart);
                    upsertAttendance.run({
                        ...entry,
                        week_start_date: weekStart,
                        daily_wage: existing ? roundMoney(existing.daily_wage) : roundMoney(worker.daily_wage)
                    });
                }
            });

            saveTransaction();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-worker-advance', (event, data = {}) => {
        try {
            const payload = normalizeAdvancePayload(data);
            const worker = db.prepare('SELECT id FROM workers WHERE id = ?').get(payload.worker_id);
            if (!worker) {
                return { success: false, error: 'العامل غير موجود' };
            }

            const info = db.prepare(`
                INSERT INTO worker_advances (worker_id, week_start_date, advance_date, amount, notes)
                VALUES (@worker_id, @week_start_date, @advance_date, @amount, @notes)
            `).run(payload);

            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-worker-advance', (event, data = {}) => {
        try {
            const id = Number(data.id);
            if (!Number.isInteger(id) || id <= 0) {
                return { success: false, error: 'معرف السلفة غير صحيح' };
            }

            const existing = db.prepare('SELECT id FROM worker_advances WHERE id = ?').get(id);
            if (!existing) {
                return { success: false, error: 'السلفة غير موجودة' };
            }

            const payload = normalizeAdvancePayload(data);
            db.prepare(`
                UPDATE worker_advances
                SET worker_id = @worker_id,
                    week_start_date = @week_start_date,
                    advance_date = @advance_date,
                    amount = @amount,
                    notes = @notes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id
            `).run({ ...payload, id });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-worker-advance', (event, idValue) => {
        try {
            const id = Number(idValue);
            if (!Number.isInteger(id) || id <= 0) {
                return { success: false, error: 'معرف السلفة غير صحيح' };
            }

            const info = db.prepare('DELETE FROM worker_advances WHERE id = ?').run(id);
            if (!info.changes) {
                return { success: false, error: 'السلفة غير موجودة' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
