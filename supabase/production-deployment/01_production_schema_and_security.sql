-- ============================================================================
-- Golden Accounting Mobile - Production SQL Schema & Security Hardening
-- Environment: Supabase Production (Clean Greenfield Deployment)
-- Target: To be executed on the new Supabase Production project
-- Path: supabase/production-deployment/01_production_schema_and_security.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. إنشاء Schema المعزولة للدوال الإدارية (غير مكشوفة لـ PostgREST API)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ============================================================================
-- 2. جداول قاعدة البيانات الإنتاجية السبعة المعتمدة (Schema: public)
-- ============================================================================

-- أ. جدول الشركات والمؤسسات
CREATE TABLE IF NOT EXISTS public.mobile_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'EGP',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ب. جدول أجهزة Windows المعتمدة لمزامنة الكمبيوتر (محمي ومحجوب عن الموبايل)
CREATE TABLE IF NOT EXISTS public.mobile_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.mobile_companies(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    public_key TEXT NOT NULL, -- المفتاح العام Ed25519 (Base64)
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ج. جدول منع هجمات إعادة الإرسال (Replay Attacks Prevention)
CREATE TABLE IF NOT EXISTS public.mobile_sync_nonces (
    nonce TEXT PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES public.mobile_devices(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_nonces_created ON public.mobile_sync_nonces(created_at);

-- د. جدول التجهيز المؤقت للمزامنة الأولية الآمنة (Staging Table)
CREATE TABLE IF NOT EXISTS public.mobile_sync_staging (
    session_id UUID NOT NULL,
    company_id UUID NOT NULL REFERENCES public.mobile_companies(id) ON DELETE CASCADE,
    batch_seq INT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('party', 'ledger')),
    payload JSONB NOT NULL, -- مصفوفة من السجلات (JSON Array)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, batch_seq, entity_type)
);

-- هـ. جدول الأطراف والجهات الموحد (العملاء والموردين)
CREATE TABLE IF NOT EXISTS public.mobile_parties (
    company_id UUID NOT NULL REFERENCES public.mobile_companies(id) ON DELETE CASCADE,
    id BIGINT NOT NULL, -- معرّف الطرف في SQLite
    code INT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    last_seq_no BIGINT NOT NULL DEFAULT 0,
    last_transaction_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, id)
);

-- و. جدول دفتر أستاذ كشف الحساب الموحد
CREATE TABLE IF NOT EXISTS public.mobile_party_ledger (
    company_id UUID NOT NULL REFERENCES public.mobile_companies(id) ON DELETE CASCADE,
    ledger_id BIGINT NOT NULL, -- معرّف السطر في party_ledger
    party_id BIGINT NOT NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN (
        'sales_invoice',    -- فاتورة مبيعات (+)
        'purchase_invoice', -- فاتورة مشتريات (-)
        'voucher_receipt',  -- سند قبض تحصيل (-)
        'voucher_payment',  -- سند صرف سداد (+)
        'opening_balance'   -- رصيد افتتاحي (+ أو -)
    )),
    doc_number TEXT,
    trans_date DATE NOT NULL,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    remaining_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    effect_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    running_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    seq_no BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, ledger_id),
    FOREIGN KEY (company_id, party_id) REFERENCES public.mobile_parties(company_id, id) ON DELETE CASCADE
);

-- ز. جدول مؤشر المزامنة وحالة الاتصال والبيانات الوصفية
CREATE TABLE IF NOT EXISTS public.mobile_sync_meta (
    company_id UUID PRIMARY KEY REFERENCES public.mobile_companies(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL DEFAULT 'EGP',
    last_heartbeat_at TIMESTAMPTZ,
    last_financial_sync_at TIMESTAMPTZ,
    last_applied_seq_no BIGINT NOT NULL DEFAULT 0,
    desktop_app_version TEXT NOT NULL DEFAULT '9.2.0',
    sync_status TEXT NOT NULL DEFAULT 'pending_first_sync',
    stream_id UUID,
    last_batch_hash TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mobile_sync_meta ADD COLUMN IF NOT EXISTS stream_id UUID;
ALTER TABLE public.mobile_sync_meta ADD COLUMN IF NOT EXISTS last_batch_hash TEXT;

-- فهارس الأداء العالي
CREATE INDEX IF NOT EXISTS idx_prod_parties_type ON public.mobile_parties(company_id, type);
CREATE INDEX IF NOT EXISTS idx_prod_parties_code ON public.mobile_parties(company_id, code);
CREATE INDEX IF NOT EXISTS idx_prod_ledger_lookup ON public.mobile_party_ledger(company_id, party_id, trans_date ASC, ledger_id ASC);

-- ============================================================================
-- 3. الصلاحيات الصارمة (GRANT / REVOKE)
-- ============================================================================

-- سحب الوصول العام بالكامل عن غير المصادق عليهم
REVOKE ALL ON TABLE 
    public.mobile_companies, public.mobile_devices, public.mobile_sync_nonces,
    public.mobile_sync_staging, public.mobile_parties, public.mobile_party_ledger,
    public.mobile_sync_meta
FROM anon;

-- سحب صلاحيات الوصول للأجهزة و Staging و Nonces عن مستخدمي الموبايل
REVOKE ALL ON TABLE 
    public.mobile_devices, public.mobile_sync_nonces, public.mobile_sync_staging
FROM authenticated;

-- حظر الكتابة والتعديل والحذف صراحةً عن مستخدمي تطبيق Android
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE 
    public.mobile_companies, public.mobile_parties, 
    public.mobile_party_ledger, public.mobile_sync_meta
FROM authenticated;

-- منح مستخدمي Android المصادق عليهم صلاحية القراءة فقط للجداول الأربعة
GRANT SELECT ON TABLE 
    public.mobile_companies, public.mobile_parties, 
    public.mobile_party_ledger, public.mobile_sync_meta
TO authenticated;

-- ============================================================================
-- 4. سياسات حماية السجلات (Row Level Security - RLS)
-- ============================================================================

ALTER TABLE public.mobile_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_party_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_sync_meta ENABLE ROW LEVEL SECURITY;

-- سياسات قراءة الشركة المعتمدة بحسب JWT الموبايل
DROP POLICY IF EXISTS "rls_prod_read_company" ON public.mobile_companies;
CREATE POLICY "rls_prod_read_company" ON public.mobile_companies
FOR SELECT TO authenticated
USING (id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "rls_prod_read_parties" ON public.mobile_parties;
CREATE POLICY "rls_prod_read_parties" ON public.mobile_parties
FOR SELECT TO authenticated
USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "rls_prod_read_ledger" ON public.mobile_party_ledger;
CREATE POLICY "rls_prod_read_ledger" ON public.mobile_party_ledger
FOR SELECT TO authenticated
USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

DROP POLICY IF EXISTS "rls_prod_read_sync_meta" ON public.mobile_sync_meta;
CREATE POLICY "rls_prod_read_sync_meta" ON public.mobile_sync_meta
FOR SELECT TO authenticated
USING (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid);

-- ============================================================================
-- 5. الدالة الإدارية 1: التفعيل الذري للمزامنة الأولية (Staged Bootstrap)
-- ============================================================================

CREATE OR REPLACE FUNCTION private.commit_bootstrap_session(
    p_session_id UUID,
    p_company_id UUID,
    p_expected_parties_count INT,
    p_expected_ledger_count INT,
    p_expected_balance_sum NUMERIC(18, 4),
    p_snapshot_seq_no BIGINT,
    p_desktop_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actual_parties_count INT := 0;
    v_actual_ledger_count INT := 0;
    v_actual_balance_sum NUMERIC(18, 4) := 0.0000;
BEGIN
    -- قفل الشركة لمنع تداخل أي عمليات أخرى أثناء الـ Bootstrap
    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

    -- 1. فحص إحصائيات الأطراف المستخرجة من مصفوفات الـ Staging
    SELECT 
        COUNT(*),
        COALESCE(SUM(NULLIF(elem->>'balance', '')::NUMERIC(18, 4)), 0.0000)
    INTO v_actual_parties_count, v_actual_balance_sum
    FROM public.mobile_sync_staging,
         jsonb_array_elements(payload) AS elem
    WHERE session_id = p_session_id AND company_id = p_company_id AND entity_type = 'party';

    -- 2. فحص إحصائيات كشف الحساب
    SELECT COUNT(*)
    INTO v_actual_ledger_count
    FROM public.mobile_sync_staging,
         jsonb_array_elements(payload) AS elem
    WHERE session_id = p_session_id AND company_id = p_company_id AND entity_type = 'ledger';

    -- 3. التحقق الصارم من الاكتمال وتطابق الأرقام قبل المساس بالبيانات الحية
    IF v_actual_parties_count != p_expected_parties_count THEN
        RAISE EXCEPTION 'Bootstrap validation failed: Expected % parties, got %', p_expected_parties_count, v_actual_parties_count;
    END IF;

    IF v_actual_ledger_count != p_expected_ledger_count THEN
        RAISE EXCEPTION 'Bootstrap validation failed: Expected % ledger rows, got %', p_expected_ledger_count, v_actual_ledger_count;
    END IF;

    IF v_actual_balance_sum != p_expected_balance_sum THEN
        RAISE EXCEPTION 'Bootstrap validation failed: Expected balance sum %, calculated %', p_expected_balance_sum, v_actual_balance_sum;
    END IF;

    -- 4. الإحلال الذري (Atomic Swap): مسح القديم ونقل الجديد في نفس المعاملة
    DELETE FROM public.mobile_parties WHERE company_id = p_company_id;
    DELETE FROM public.mobile_party_ledger WHERE company_id = p_company_id;

    -- إدراج الأطراف
    INSERT INTO public.mobile_parties (
        company_id, id, code, name, phone, address, type, balance, last_seq_no, last_transaction_date, updated_at
    )
    SELECT 
        p_company_id,
        (elem->>'id')::BIGINT,
        NULLIF(elem->>'code', '')::INT,
        elem->>'name',
        elem->>'phone',
        elem->>'address',
        elem->>'type',
        COALESCE(NULLIF(elem->>'balance', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'seq_no', '')::BIGINT, p_snapshot_seq_no),
        NULLIF(elem->>'last_transaction_date', '')::DATE,
        now()
    FROM public.mobile_sync_staging,
         jsonb_array_elements(payload) AS elem
    WHERE session_id = p_session_id AND company_id = p_company_id AND entity_type = 'party';

    -- إدراج حركات كشف الحساب
    INSERT INTO public.mobile_party_ledger (
        company_id, ledger_id, party_id, doc_type, doc_number, trans_date,
        total_amount, paid_amount, remaining_amount, effect_amount, running_balance,
        seq_no, notes, created_at
    )
    SELECT 
        p_company_id,
        (elem->>'ledger_id')::BIGINT,
        (elem->>'party_id')::BIGINT,
        elem->>'doc_type',
        elem->>'doc_number',
        (elem->>'trans_date')::DATE,
        COALESCE(NULLIF(elem->>'total_amount', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'paid_amount', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'remaining_amount', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'effect_amount', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'running_balance', '')::NUMERIC(18, 4), 0.0000),
        COALESCE(NULLIF(elem->>'seq_no', '')::BIGINT, p_snapshot_seq_no),
        elem->>'notes',
        now()
    FROM public.mobile_sync_staging,
         jsonb_array_elements(payload) AS elem
    WHERE session_id = p_session_id AND company_id = p_company_id AND entity_type = 'ledger';

    -- تحديث سجل المزامنة
    INSERT INTO public.mobile_sync_meta (
        company_id, last_heartbeat_at, last_financial_sync_at, last_applied_seq_no, desktop_app_version, sync_status, updated_at
    )
    VALUES (
        p_company_id, now(), now(), p_snapshot_seq_no, p_desktop_version, 'synced', now()
    )
    ON CONFLICT (company_id) DO UPDATE SET
        last_heartbeat_at = now(),
        last_financial_sync_at = now(),
        last_applied_seq_no = EXCLUDED.last_applied_seq_no,
        desktop_app_version = EXCLUDED.desktop_app_version,
        sync_status = 'synced',
        updated_at = now();

    -- تنظيف سجلات الـ Staging بعد التثبيت الناجح
    DELETE FROM public.mobile_sync_staging WHERE session_id = p_session_id AND company_id = p_company_id;

    RETURN jsonb_build_object(
        'success', true,
        'parties_count', v_actual_parties_count,
        'ledger_count', v_actual_ledger_count,
        'balance_sum', v_actual_balance_sum
    );
END;
$$;

REVOKE ALL ON FUNCTION private.commit_bootstrap_session FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.commit_bootstrap_session TO service_role;

-- ============================================================================
-- 6. الدالة الإدارية 2: التطبيق الذري لدفعات المزامنة التفاضلية (Delta Sync)
-- ============================================================================

CREATE OR REPLACE FUNCTION private.apply_delta_sync_batch(
    p_company_id UUID,
    p_events JSONB,
    p_batch_seq_no BIGINT,
    p_desktop_version TEXT,
    p_stream_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    elem JSONB;
    v_applied_count INT := 0;
    v_skipped_count INT := 0;
    v_existing_seq BIGINT;
    v_last_applied_seq BIGINT;
    v_current_stream UUID;
BEGIN
    -- 1. قفل استشاري يمنع أي محركين من إرسال دفعات متزامنة لنفس الشركة
    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

    -- 2. التحقق من تسلسل الدفعة ومنع التضارب أو إعادة المعالجة (Idempotency Guard)
    SELECT last_applied_seq_no, stream_id INTO v_last_applied_seq, v_current_stream
    FROM public.mobile_sync_meta
    WHERE company_id = p_company_id
    FOR UPDATE;

    IF p_stream_id IS NOT NULL THEN
        IF v_current_stream IS NULL THEN
            UPDATE public.mobile_sync_meta
            SET stream_id = p_stream_id
            WHERE company_id = p_company_id;
            v_current_stream := p_stream_id;
        ELSIF v_current_stream <> p_stream_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'status', 'stream_conflict',
                'error', 'A different sync stream is registered for this company',
                'batch_seq_no', p_batch_seq_no
            );
        END IF;
    END IF;

    -- التحقق إن كانت الدفعة طُبقت بالفعل سابقاً وتكرر إرسالها بسبب انقطاع اتصال لحظي
    IF v_last_applied_seq IS NOT NULL AND p_batch_seq_no = v_last_applied_seq THEN
        IF (SELECT last_batch_hash FROM public.mobile_sync_meta WHERE company_id = p_company_id) = md5(p_events::text) THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'already_applied',
                'batch_seq_no', p_batch_seq_no,
                'applied_events', 0,
                'skipped_events', 0
            );
        END IF;
    END IF;

    IF v_last_applied_seq IS NOT NULL AND p_batch_seq_no <= v_last_applied_seq THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'resync_required',
            'applied_events', 0,
            'skipped_events', 0,
            'batch_seq_no', p_batch_seq_no,
            'expected_seq', (v_last_applied_seq + 1)
        );
    END IF;

    IF v_last_applied_seq IS NOT NULL AND p_batch_seq_no > v_last_applied_seq + 1 THEN
        RAISE EXCEPTION 'Sequence conflict: Expected %, got %', (v_last_applied_seq + 1), p_batch_seq_no;
    END IF;

    -- 3. معالجة الأحداث التفاضلية
    FOR elem IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        -- أ. معالجة تحديثات الأطراف (إضافة أو تعديل الحقول)
        IF elem->>'entity_type' = 'party' AND elem->>'action' = 'UPSERT' THEN
            SELECT last_seq_no INTO v_existing_seq
            FROM public.mobile_parties
            WHERE company_id = p_company_id AND id = (elem->'data'->>'id')::BIGINT;

            IF v_existing_seq IS NOT NULL AND v_existing_seq > (elem->'data'->>'seq_no')::BIGINT THEN
                v_skipped_count := v_skipped_count + 1;
            ELSE
                INSERT INTO public.mobile_parties (
                    company_id, id, code, name, phone, address, type, balance, last_seq_no, last_transaction_date, updated_at
                ) VALUES (
                    p_company_id,
                    (elem->'data'->>'id')::BIGINT,
                    NULLIF(elem->'data'->>'code', '')::INT,
                    elem->'data'->>'name',
                    elem->'data'->>'phone',
                    elem->'data'->>'address',
                    elem->'data'->>'type',
                    COALESCE(NULLIF(elem->'data'->>'balance', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'seq_no', '')::BIGINT, p_batch_seq_no),
                    NULLIF(elem->'data'->>'last_transaction_date', '')::DATE,
                    now()
                )
                ON CONFLICT (company_id, id) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    type = EXCLUDED.type,
                    balance = EXCLUDED.balance,
                    last_seq_no = EXCLUDED.last_seq_no,
                    last_transaction_date = EXCLUDED.last_transaction_date,
                    updated_at = now();
                v_applied_count := v_applied_count + 1;
            END IF;

        -- ب. معالجة حذف طرف
        ELSIF elem->>'entity_type' = 'party' AND elem->>'action' = 'DELETE' THEN
            DELETE FROM public.mobile_parties
            WHERE company_id = p_company_id AND id = (elem->>'party_id')::BIGINT;
            v_applied_count := v_applied_count + 1;

        -- ج. معالجة إضافة وتعديل أسطر دفتر الأستاذ
        ELSIF elem->>'entity_type' = 'party_ledger' AND elem->>'action' = 'UPSERT' THEN
            SELECT seq_no INTO v_existing_seq
            FROM public.mobile_party_ledger
            WHERE company_id = p_company_id AND ledger_id = (elem->'data'->>'ledger_id')::BIGINT;

            IF v_existing_seq IS NOT NULL AND v_existing_seq > (elem->'data'->>'seq_no')::BIGINT THEN
                v_skipped_count := v_skipped_count + 1;
            ELSE
                INSERT INTO public.mobile_party_ledger (
                    company_id, ledger_id, party_id, doc_type, doc_number, trans_date,
                    total_amount, paid_amount, remaining_amount, effect_amount, running_balance,
                    seq_no, notes, created_at
                ) VALUES (
                    p_company_id,
                    (elem->'data'->>'ledger_id')::BIGINT,
                    (elem->'data'->>'party_id')::BIGINT,
                    elem->'data'->>'doc_type',
                    elem->'data'->>'doc_number',
                    (elem->'data'->>'trans_date')::DATE,
                    COALESCE(NULLIF(elem->'data'->>'total_amount', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'paid_amount', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'remaining_amount', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'effect_amount', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'running_balance', '')::NUMERIC(18, 4), 0.0000),
                    COALESCE(NULLIF(elem->'data'->>'seq_no', '')::BIGINT, p_batch_seq_no),
                    elem->'data'->>'notes',
                    now()
                )
                ON CONFLICT (company_id, ledger_id) DO UPDATE SET
                    party_id = EXCLUDED.party_id,
                    doc_type = EXCLUDED.doc_type,
                    doc_number = EXCLUDED.doc_number,
                    trans_date = EXCLUDED.trans_date,
                    total_amount = EXCLUDED.total_amount,
                    paid_amount = EXCLUDED.paid_amount,
                    remaining_amount = EXCLUDED.remaining_amount,
                    effect_amount = EXCLUDED.effect_amount,
                    running_balance = EXCLUDED.running_balance,
                    seq_no = EXCLUDED.seq_no,
                    notes = EXCLUDED.notes;
                v_applied_count := v_applied_count + 1;
            END IF;

        -- د. معالجة حذف أسطر دفتر الأستاذ
        ELSIF elem->>'entity_type' = 'party_ledger' AND elem->>'action' = 'DELETE' THEN
            DELETE FROM public.mobile_party_ledger
            WHERE company_id = p_company_id AND ledger_id = (elem->>'ledger_id')::BIGINT;
            v_applied_count := v_applied_count + 1;
        END IF;
    END LOOP;

    -- 4. تحديث مؤشر المزامنة للشركة برقم الدفعة المؤكد
    INSERT INTO public.mobile_sync_meta (
        company_id, last_heartbeat_at, last_financial_sync_at, last_applied_seq_no, last_batch_hash, desktop_app_version, sync_status, updated_at
    )
    VALUES (
        p_company_id, now(), now(), p_batch_seq_no, md5(p_events::text), p_desktop_version, 'synced', now()
    )
    ON CONFLICT (company_id) DO UPDATE SET
        last_heartbeat_at = now(),
        last_financial_sync_at = now(),
        last_applied_seq_no = EXCLUDED.last_applied_seq_no,
        last_batch_hash = EXCLUDED.last_batch_hash,
        desktop_app_version = EXCLUDED.desktop_app_version,
        sync_status = 'synced',
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'applied_events', v_applied_count,
        'skipped_events', v_skipped_count,
        'batch_seq_no', p_batch_seq_no
    );
END;
$$;

REVOKE ALL ON FUNCTION private.apply_delta_sync_batch FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.apply_delta_sync_batch TO service_role;

CREATE OR REPLACE FUNCTION private.reconcile_company_ids(
    p_company_id UUID,
    p_party_ids BIGINT[],
    p_ledger_ids BIGINT[],
    p_expected_parties INT,
    p_expected_ledger INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_del_l INT;
    v_del_p INT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

    IF cardinality(p_party_ids) <> p_expected_parties OR cardinality(p_ledger_ids) <> p_expected_ledger THEN
        RAISE EXCEPTION 'Reconcile count mismatch';
    END IF;

    IF cardinality(p_party_ids) = 0 AND EXISTS (SELECT 1 FROM public.mobile_parties WHERE company_id = p_company_id) THEN
        RAISE EXCEPTION 'Refusing to wipe company data from empty snapshot';
    END IF;

    DELETE FROM public.mobile_party_ledger 
    WHERE company_id = p_company_id AND NOT (ledger_id = ANY(p_ledger_ids));
    GET DIAGNOSTICS v_del_l = ROW_COUNT;

    DELETE FROM public.mobile_parties 
    WHERE company_id = p_company_id AND NOT (id = ANY(p_party_ids));
    GET DIAGNOSTICS v_del_p = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_ledger', v_del_l,
        'deleted_parties', v_del_p
    );
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_company_ids FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_company_ids TO service_role;

CREATE OR REPLACE FUNCTION private.rebind_sync_stream(
    p_company_id UUID,
    p_stream_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_last TIMESTAMPTZ;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

    SELECT last_financial_sync_at INTO v_last 
    FROM public.mobile_sync_meta 
    WHERE company_id = p_company_id 
    FOR UPDATE;

    IF v_last IS NOT NULL AND v_last > now() - interval '30 minutes' THEN
        RETURN jsonb_build_object('success', false, 'status', 'stream_busy');
    END IF;

    UPDATE public.mobile_sync_meta 
    SET stream_id = p_stream_id,
        last_applied_seq_no = 0,
        last_batch_hash = NULL
    WHERE company_id = p_company_id;

    RETURN jsonb_build_object('success', true, 'status', 'rebound');
END;
$$;

REVOKE ALL ON FUNCTION private.rebind_sync_stream FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.rebind_sync_stream TO service_role;

-- ============================================================================
-- 7. تفعيل Realtime على الجداول الحية فقط مع العزل
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mobile_parties'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_parties;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mobile_party_ledger'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_party_ledger;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mobile_sync_meta'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_sync_meta;
        END IF;
    END IF;
END $$;
