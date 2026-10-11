// ============================================================================
// Golden Accounting Mobile - Production Supabase Edge Function: /sync-ingest
// Target: Production Supabase Project
// Path: supabase/functions/sync-ingest/index.ts
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// ── محددات الأحجام والضوابط الأمنية ──
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB كحد أقصى للحزمة
const MAX_CHUNK_ITEMS = 1000;              // 1000 سجل كحد أقصى للدفعة في الـ Staging
const MAX_DELTA_EVENTS = 500;              // 500 حدث كحد أقصى للدفعة التفاضلية
const MAX_TIME_DRIFT_MS = 300000;          // 5 دقائق كحد أقصى لانحراف الساعة (Time Drift)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id, x-timestamp, x-nonce, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

let sqlClient: any = null;

function getDbClient() {
  if (!sqlClient) {
    if (!SUPABASE_DB_URL) {
      throw new Error("SUPABASE_DB_URL environment variable is not defined");
    }
    sqlClient = postgres(SUPABASE_DB_URL, {
      prepare: false, // مطلوب لـ Transaction Mode في Supavisor Pooler
      max: 1,         // اتصال واحد لكل Edge Worker
      idle_timeout: 10,
      connect_timeout: 10,
      ssl: "require"
    });
  }
  return sqlClient;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── قراءة متدفقة مع سقف أقصى للحجم لمنع هجمات حجب الخدمة ──
async function readBoundedBody(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

// ── تعقيم وتنظيف الحقول وتثبيت company_id المعتمد من السيرفر ──
function sanitizePartyRow(verifiedCompanyId: string, raw: any) {
  return {
    company_id: verifiedCompanyId,
    id: Number(raw.id),
    code: raw.code !== undefined && raw.code !== null ? Number(raw.code) : null,
    name: String(raw.name || "").trim(),
    phone: raw.phone ? String(raw.phone).trim() : null,
    address: raw.address ? String(raw.address).trim() : null,
    type: ["customer", "supplier", "both"].includes(raw.type) ? raw.type : "customer",
    balance: String(raw.balance ?? "0.0000"),
    seq_no: Number(raw.seq_no || raw.last_seq_no || 0),
    last_transaction_date: raw.last_transaction_date || null
  };
}

function sanitizeLedgerRow(verifiedCompanyId: string, raw: any) {
  const allowedDocTypes = [
    "sales_invoice",
    "purchase_invoice",
    "voucher_receipt",
    "voucher_payment",
    "opening_balance"
  ];

  return {
    company_id: verifiedCompanyId,
    ledger_id: Number(raw.ledger_id),
    party_id: Number(raw.party_id),
    doc_type: allowedDocTypes.includes(raw.doc_type) ? raw.doc_type : "opening_balance",
    doc_number: raw.doc_number ? String(raw.doc_number).trim() : null,
    trans_date: String(raw.trans_date || new Date().toISOString().slice(0, 10)),
    total_amount: String(raw.total_amount ?? "0.0000"),
    paid_amount: String(raw.paid_amount ?? "0.0000"),
    remaining_amount: String(raw.remaining_amount ?? "0.0000"),
    effect_amount: String(raw.effect_amount ?? "0.0000"),
    running_balance: String(raw.running_balance ?? "0.0000"),
    seq_no: Number(raw.seq_no || 0),
    notes: raw.notes ? String(raw.notes).trim() : null
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large (max 5MB)" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const deviceId = req.headers.get("X-Device-Id");
    const timestampStr = req.headers.get("X-Timestamp");
    const nonce = req.headers.get("X-Nonce");
    const signatureBase64 = req.headers.get("X-Signature");

    if (!deviceId || !timestampStr || !nonce || !signatureBase64) {
      return new Response(JSON.stringify({ error: "Missing authentication headers" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. فحص نافذة الوقت (5 دقائق)
    const requestTime = new Date(timestampStr).getTime();
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_TIME_DRIFT_MS) {
      return new Response(JSON.stringify({ error: "Timestamp expired or clock out of sync" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. التحقق من هوية الجهاز وحالته ومفتاحه العام
    const { data: device, error: devError } = await supabase
      .from("mobile_devices")
      .select("company_id, public_key, is_active")
      .eq("id", deviceId)
      .single();

    if (devError || !device || !device.is_active) {
      return new Response(JSON.stringify({ error: "Device revoked or unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const verifiedCompanyId = device.company_id;

    // قراءة جسم الطلب المقيد بالحجم
    let rawBody = "";
    try {
      rawBody = await readBoundedBody(req, MAX_PAYLOAD_BYTES);
    } catch (e: any) {
      if (e?.message === "PAYLOAD_TOO_LARGE") {
        return new Response(JSON.stringify({ error: "Payload body exceeds 5MB limit" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw e;
    }

    // 3. التحقق من التوقيع الرقمي Ed25519 في الذاكرة
    const rawPublicKey = decodeBase64(device.public_key);
    const rawSignature = decodeBase64(signatureBase64);
    const canonicalMessage = new TextEncoder().encode(`${timestampStr}.${nonce}.${verifiedCompanyId}.${rawBody}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawPublicKey,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify("Ed25519", cryptoKey, rawSignature, canonicalMessage);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid cryptographic signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. منع هجمات إعادة الإرسال (Replay Prevention)
    const { error: nonceError } = await supabase
      .from("mobile_sync_nonces")
      .insert({ nonce, device_id: deviceId });

    if (nonceError) {
      return new Response(JSON.stringify({ error: "Replay attack detected: Nonce already used" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.parse(rawBody);

    // ── الحالة 1: نبضة اتصال الكمبيوتر (Heartbeat) ──
    if (payload.mode === "heartbeat") {
      await supabase.from("mobile_devices").update({
        last_heartbeat_at: new Date().toISOString()
      }).eq("id", deviceId);

      await supabase.from("mobile_sync_meta").upsert({
        company_id: verifiedCompanyId,
        last_heartbeat_at: new Date().toISOString(),
        desktop_app_version: payload.desktop_version || "9.1.6"
      }, { onConflict: "company_id" });

      return new Response(JSON.stringify({ success: true, mode: "heartbeat_ack" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── الحالة 2: دفعات المزامنة الأولية المؤقتة (Bootstrap Staging Chunk) ──
    if (payload.mode === "bootstrap_chunk") {
      const entityType = payload.entity_type;
      const rawList = Array.isArray(payload.data) ? payload.data : [];

      if (!["party", "ledger"].includes(entityType)) {
        return new Response(JSON.stringify({ error: "Invalid entity_type in chunk" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (rawList.length > MAX_CHUNK_ITEMS) {
        return new Response(JSON.stringify({ error: `Chunk exceeds ${MAX_CHUNK_ITEMS} items limit` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const sanitizedChunk = entityType === "party"
        ? rawList.map((r: any) => sanitizePartyRow(verifiedCompanyId, r))
        : rawList.map((r: any) => sanitizeLedgerRow(verifiedCompanyId, r));

      const { error: stagingError } = await supabase
        .from("mobile_sync_staging")
        .upsert({
          session_id: payload.session_id,
          company_id: verifiedCompanyId,
          batch_seq: payload.batch_seq,
          entity_type: entityType,
          payload: sanitizedChunk
        }, { onConflict: "session_id,batch_seq,entity_type" });

      if (stagingError) {
        return new Response(JSON.stringify({ error: stagingError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: true, mode: "chunk_staged", batch_seq: payload.batch_seq }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── الحالة 3: تثبيت المزامنة الأولية الذرية (Bootstrap Commit) ──
    if (payload.mode === "bootstrap_commit") {
      const db = getDbClient();
      const result = await db`
        SELECT private.commit_bootstrap_session(
          ${payload.session_id}::uuid,
          ${verifiedCompanyId}::uuid,
          ${Number(payload.expected_parties_count)}::int,
          ${Number(payload.expected_ledger_count)}::int,
          ${String(payload.expected_balance_sum)}::numeric,
          ${Number(payload.snapshot_seq_no || 100)}::bigint,
          ${payload.desktop_version || "9.1.6"}::text
        ) AS res
      `;

      const commitRes = result[0]?.res;
      return new Response(JSON.stringify({ success: true, result: commitRes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── الحالة 4: دفعات المزامنة التفاضلية الذرية (Atomic Delta Batch) ──
    if (payload.mode === "delta_batch") {
      const rawEvents = Array.isArray(payload.events) ? payload.events : [];

      if (rawEvents.length > MAX_DELTA_EVENTS) {
        return new Response(JSON.stringify({ error: `Delta batch limit exceeded (max ${MAX_DELTA_EVENTS})` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const sanitizedEvents = [];
      for (const ev of rawEvents) {
        if (ev.entity_type === "party" && ev.action === "UPSERT") {
          sanitizedEvents.push({
            entity_type: "party",
            action: "UPSERT",
            data: sanitizePartyRow(verifiedCompanyId, ev.data)
          });
        } else if (ev.entity_type === "party" && ev.action === "DELETE") {
          sanitizedEvents.push({
            entity_type: "party",
            action: "DELETE",
            party_id: Number(ev.party_id)
          });
        } else if (ev.entity_type === "party_ledger" && ev.action === "UPSERT") {
          sanitizedEvents.push({
            entity_type: "party_ledger",
            action: "UPSERT",
            data: sanitizeLedgerRow(verifiedCompanyId, ev.data)
          });
        } else if (ev.entity_type === "party_ledger" && ev.action === "DELETE") {
          sanitizedEvents.push({
            entity_type: "party_ledger",
            action: "DELETE",
            ledger_id: Number(ev.ledger_id)
          });
        }
      }

      const db = getDbClient();
      const result = await db`
        SELECT private.apply_delta_sync_batch(
          ${verifiedCompanyId}::uuid,
          ${db.json(sanitizedEvents)},
          ${Number(payload.batch_seq_no || 0)}::bigint,
          ${payload.desktop_version || "9.1.6"}::text
        ) AS res
      `;

      const deltaRes = result[0]?.res;
      return new Response(JSON.stringify({ success: true, result: deltaRes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown sync mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
