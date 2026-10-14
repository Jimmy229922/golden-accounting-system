import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LICENSE_SIGNING_KEY_RAW = Deno.env.get("LICENSE_SIGNING_KEY") || "MC4CAQAwBQYDK2VwBCIEIOIdYd2qNkItHXuEeVnlS8Xf0vRB/GSls/ufGMdrzAkJ";
const MASTER_KEY_RAW = Deno.env.get("LEGACY_ACTIVATION_KEY") || "AX-2026-MK-7F4B9C3E-PLN7-TS9X-SECURE-8831";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

let cachedSignKey: CryptoKey | null = null;
async function getSigningKey(): Promise<CryptoKey> {
  if (!cachedSignKey) {
    const keyDer = decodeBase64(LICENSE_SIGNING_KEY_RAW);
    cachedSignKey = await crypto.subtle.importKey(
      "pkcs8",
      keyDer,
      { name: "Ed25519" },
      false,
      ["sign"]
    );
  }
  return cachedSignKey;
}

async function signCertificatePayload(payload: Record<string, any>): Promise<string> {
  const key = await getSigningKey();
  const canonicalString = `${payload.company_id}|${payload.machine_id}|${payload.status}|${payload.expires_at}|${payload.issued_at}|${payload.offline_grace_days}`;
  const data = new TextEncoder().encode(canonicalString);
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, data);
  return encodeBase64(new Uint8Array(signature));
}

async function hmacSha256(keyString: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyString),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizeCode(code: string): string {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    const body = await req.json();
    const action = String(body.action || "").trim();
    const companyId = String(body.company_id || "").trim();
    const rawMachineId = String(body.machine_id || "").trim();
    const desktopVersion = String(body.desktop_version || "10.1.1").trim();

    if (!companyId || !rawMachineId) {
      return new Response(JSON.stringify({ success: false, error: "MISSING_REQUIRED_FIELDS", message: "معرف الشركة ورقم الماكينة مطلوبان" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "check") {
      const { data: license, error: licErr } = await supabase
        .from("client_licenses")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (licErr) {
        return new Response(JSON.stringify({ success: false, error: "DB_ERROR", message: licErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let activeRec = license;

      if (!activeRec) {
        const { data: usedTrial } = await supabase
          .from("client_licenses")
          .select("id")
          .or(`bound_machine_id.eq.${rawMachineId},machine_id.eq.${rawMachineId}`)
          .limit(1)
          .maybeSingle();

        if (usedTrial) {
          return new Response(JSON.stringify({
            success: false,
            error: "TRIAL_ALREADY_USED",
            message: "تم استخدام الفترة التجريبية لهذا الجهاز من قبل"
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const now = new Date();
        const trialExpiry = new Date(now.getTime() + 15 * 86400000);
        const { data: newLic, error: createErr } = await supabase
          .from("client_licenses")
          .insert({
            company_id: companyId,
            company_name: String(body.company_name || "مؤسسة جديدة").trim(),
            machine_id: rawMachineId,
            bound_machine_id: rawMachineId,
            last_seen_machine_id: rawMachineId,
            license_status: "trial",
            trial_starts_at: now.toISOString(),
            trial_ends_at: trialExpiry.toISOString(),
            expires_at: trialExpiry.toISOString(),
            renew_count: 0,
            last_heartbeat_at: now.toISOString(),
            desktop_version: desktopVersion,
            notes: "تسجيل تجريبي تلقائي عبر license-gateway"
          })
          .select("*")
          .single();

        if (createErr || !newLic) {
          return new Response(JSON.stringify({ success: false, error: "CREATE_FAILED", message: createErr?.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        activeRec = newLic;
      } else {
        const isLifetime = activeRec.license_status === "lifetime";

        if (activeRec.bound_machine_id && activeRec.bound_machine_id !== rawMachineId) {
          return new Response(JSON.stringify({
            success: false,
            error: "UNAUTHORIZED_DEVICE",
            message: "الترخيص مربوط بجهاز كمبيوتر آخر"
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const updates: Record<string, any> = {
          last_heartbeat_at: new Date().toISOString(),
          last_seen_machine_id: rawMachineId,
          desktop_version: desktopVersion
        };

        if (!activeRec.bound_machine_id && !isLifetime) {
          updates.bound_machine_id = rawMachineId;
        }

        const { data: updated, error: updErr } = await supabase
          .from("client_licenses")
          .update(updates)
          .eq("id", activeRec.id)
          .select("*")
          .single();

        if (!updErr && updated) {
          activeRec = updated;
        }
      }

      const isLifetime = activeRec.license_status === "lifetime";
      const isSuspended = activeRec.license_status === "suspended";
      const now = new Date();
      const expiresAtDate = new Date(activeRec.expires_at);
      const isValid = isLifetime ? true : (!isSuspended && expiresAtDate > now);
      const remainingDays = isLifetime ? 99999 : Math.max(0, Math.ceil((expiresAtDate.getTime() - now.getTime()) / 86400000));
      const offlineGraceDays = isLifetime ? 99999 : 14;

      const certPayload = {
        company_id: activeRec.company_id,
        machine_id: rawMachineId,
        status: activeRec.license_status,
        expires_at: activeRec.expires_at,
        issued_at: now.toISOString(),
        offline_grace_days: offlineGraceDays
      };

      const signature = await signCertificatePayload(certPayload);

      return new Response(JSON.stringify({
        success: true,
        certificate: certPayload,
        signature,
        is_valid: isValid,
        remaining_days: remainingDays,
        server_time: now.toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "activate") {
      const codeInput = normalizeCode(body.activation_code || "");
      if (!codeInput) {
        return new Response(JSON.stringify({ success: false, error: "EMPTY_CODE", message: "يرجى إدخال كود التفعيل" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const rawMid = rawMachineId;
      const expectedHmac = await hmacSha256(MASTER_KEY_RAW, rawMid);
      const expectedCode = normalizeCode(expectedHmac.substring(0, 16));

      if (codeInput !== expectedCode) {
        return new Response(JSON.stringify({
          success: false,
          error: "INVALID_CODE",
          message: "كود التفعيل غير صحيح أو خاص بجهاز آخر"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: licRec, error: fetchErr } = await supabase
        .from("client_licenses")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (fetchErr || !licRec) {
        return new Response(JSON.stringify({ success: false, error: "LICENSE_NOT_FOUND", message: "سجل الترخيص غير موجود" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const now = new Date();
      const currentExpiry = new Date(licRec.expires_at || now.toISOString());
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + 30 * 86400000);

      const { data: renewed, error: renewErr } = await supabase
        .from("client_licenses")
        .update({
          license_status: "active",
          expires_at: newExpiry.toISOString(),
          renew_count: (Number(licRec.renew_count) || 0) + 1,
          bound_machine_id: rawMachineId,
          last_seen_machine_id: rawMachineId,
          last_heartbeat_at: now.toISOString(),
          notes: `تجديد معتمد عبر license-gateway في ${now.toISOString()}`
        })
        .eq("id", licRec.id)
        .select("*")
        .single();

      if (renewErr || !renewed) {
        return new Response(JSON.stringify({ success: false, error: "RENEW_FAILED", message: renewErr?.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const certPayload = {
        company_id: renewed.company_id,
        machine_id: rawMachineId,
        status: renewed.license_status,
        expires_at: renewed.expires_at,
        issued_at: now.toISOString(),
        offline_grace_days: 14
      };

      const signature = await signCertificatePayload(certPayload);

      return new Response(JSON.stringify({
        success: true,
        message: "تم تفعيل وتجديد الاشتراك بنجاح",
        certificate: certPayload,
        signature,
        is_valid: true,
        expires_at: newExpiry.toISOString(),
        server_time: now.toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "recovery") {
      const challenge = String(body.challenge || "").trim().toUpperCase();
      const recoveryCodeInput = normalizeCode(body.recovery_code || "");
      const adminUsername = String(body.admin_username || "Jimmy").trim();

      if (!challenge || !recoveryCodeInput) {
        return new Response(JSON.stringify({ success: false, error: "EMPTY_FIELDS", message: "الطلب وكود الاسترداد مطلوبان" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const expectedHmac = await hmacSha256(MASTER_KEY_RAW, `RECOVERY-${challenge}`);
      const expectedCode = normalizeCode(expectedHmac.slice(0, 8));

      if (recoveryCodeInput !== expectedCode) {
        return new Response(JSON.stringify({
          success: false,
          error: "INVALID_RECOVERY_CODE",
          message: "كود الاسترداد غير صحيح"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await supabase.from("client_recovery_logs").insert({
        company_id: companyId,
        challenge,
        admin_username: adminUsername,
        device_id: body.device_id || null,
        recovery_method: "license_gateway_verified"
      });

      const now = new Date();
      const authPayload = {
        company_id: companyId,
        machine_id: rawMachineId,
        challenge,
        authorized: true,
        issued_at: now.toISOString()
      };

      const authCanonical = `RECOVERY_AUTH|${companyId}|${rawMachineId}|${challenge}|${authPayload.issued_at}`;
      const key = await getSigningKey();
      const sigBytes = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(authCanonical));
      const authSignature = encodeBase64(new Uint8Array(sigBytes));

      return new Response(JSON.stringify({
        success: true,
        authorized: true,
        auth_token: authSignature,
        issued_at: authPayload.issued_at,
        server_time: now.toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: false, error: "UNKNOWN_ACTION", message: "إجراء غير معروف" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: "GATEWAY_ERROR", message: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
