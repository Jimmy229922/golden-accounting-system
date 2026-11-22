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

    if (!companyId || (!rawMachineId && action !== "poll_notices" && action !== "mark_notices_read" && action !== "submit_support_ticket" && action !== "report_security_alert")) {
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
        const incomingPhone = String(body.company_phone || "").trim();
        const incomingActivity = String(body.company_activity || "").trim();
        const { data: newLic, error: createErr } = await supabase
          .from("client_licenses")
          .insert({
            company_id: companyId,
            company_name: String(body.company_name || "مؤسسة جديدة").trim(),
            company_phone: incomingPhone,
            company_activity: incomingActivity,
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
        try {
          const { data: tgCfg } = await supabase
            .from("app_global_config")
            .select("telegram_bot_token, telegram_chat_id, telegram_alerts_enabled")
            .eq("id", 1)
            .maybeSingle();
          if (tgCfg?.telegram_alerts_enabled && tgCfg?.telegram_bot_token && tgCfg?.telegram_chat_id) {
            const alertText =
              `<b>🆕 تسجيل عميل جديد في النظام</b>\n` +
              `• الشركة: <b>${String(newLic.company_name || "مؤسسة جديدة")}</b>\n` +
              `• الجهاز: <code>${rawMachineId}</code>\n` +
              `• الإصدار: v${desktopVersion}\n` +
              `• الحالة: فترة تجريبية`;
            fetch(`https://api.telegram.org/bot${tgCfg.telegram_bot_token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: tgCfg.telegram_chat_id,
                text: alertText,
                parse_mode: "HTML"
              })
            }).catch(() => {});
          }
        } catch (_) {}
      } else {
        const isLifetime = activeRec.license_status === "lifetime";

        if (activeRec.bound_machine_id && activeRec.bound_machine_id !== rawMachineId) {
          try {
            const { data: tgCfg } = await supabase
              .from("app_global_config")
              .select("telegram_alerts_enabled, telegram_bot_token, telegram_chat_id")
              .eq("id", 1)
              .maybeSingle();
            if (tgCfg?.telegram_alerts_enabled && tgCfg?.telegram_bot_token && tgCfg?.telegram_chat_id) {
              const alertText =
                `<b>🚨 تحذير أمني: محاولة فتح الترخيص على جهاز آخر</b>\n` +
                `• الشركة: <b>${String(activeRec.company_name || companyId)}</b>\n` +
                `• الجهاز المعتمد: <code>${activeRec.bound_machine_id}</code>\n` +
                `• الجهاز المحاول: <code>${rawMachineId}</code>\n` +
                `• الإصدار: v${desktopVersion}`;
              fetch(`https://api.telegram.org/bot${tgCfg.telegram_bot_token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: tgCfg.telegram_chat_id,
                  text: alertText,
                  parse_mode: "HTML"
                })
              }).catch(() => {});
            }
          } catch (_) {}
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

        const incomingCompanyName = String(body.company_name || "").trim();
        const defaultNames = ["مؤسسة جديدة", "اسم المؤسسة", "مؤسسة الذهب للمحاسبة", "مؤسسة غير مسماة"];
        if (incomingCompanyName && !defaultNames.includes(incomingCompanyName) && activeRec.company_name !== incomingCompanyName) {
          updates.company_name = incomingCompanyName;
        }
        const incomingPhone = String(body.company_phone || "").trim();
        if (incomingPhone && activeRec.company_phone !== incomingPhone) {
          updates.company_phone = incomingPhone;
        }
        const incomingActivity = String(body.company_activity || "").trim();
        if (incomingActivity && activeRec.company_activity !== incomingActivity) {
          updates.company_activity = incomingActivity;
        }

        if (!activeRec.bound_machine_id) {
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

      const now = new Date();
      let currentStatus = String(activeRec.license_status || "trial");
      let readOnlyUntilIso = activeRec.read_only_until ? String(activeRec.read_only_until) : "";
      let readOnlyMode = false;

      if (currentStatus === "read_only") {
        const roMs = readOnlyUntilIso ? new Date(readOnlyUntilIso).getTime() : 0;
        if (roMs > now.getTime()) {
          readOnlyMode = true;
        } else {
          currentStatus = "suspended";
          await supabase
            .from("client_licenses")
            .update({ license_status: "suspended", updated_at: now.toISOString() })
            .eq("id", activeRec.id);
        }
      }

      const isLifetime = currentStatus === "lifetime";
      const isSuspended = currentStatus === "suspended";
      const expiresAtDate = new Date(activeRec.expires_at);
      const isValid = isLifetime ? true : readOnlyMode ? true : (!isSuspended && expiresAtDate > now);
      const remainingDays = isLifetime ? 99999 : Math.max(0, Math.ceil((expiresAtDate.getTime() - now.getTime()) / 86400000));
      const offlineGraceDays = isLifetime ? 99999 : 14;

      const certPayload = {
        company_id: activeRec.company_id,
        machine_id: rawMachineId,
        status: currentStatus,
        expires_at: activeRec.expires_at,
        issued_at: now.toISOString(),
        offline_grace_days: offlineGraceDays
      };

      const signature = await signCertificatePayload(certPayload);
      const features = (activeRec.features && typeof activeRec.features === "object" && !Array.isArray(activeRec.features))
        ? activeRec.features
        : {};

      const { data: globalCfg } = await supabase
        .from("app_global_config")
        .select("min_supported_version, support_whatsapp, force_update_message, announcement_message, announcement_active")
        .eq("id", 1)
        .maybeSingle();

      const pendingRemoteCommand = activeRec.remote_command || null;
      if (pendingRemoteCommand) {
        await supabase
          .from("client_licenses")
          .update({ remote_command: null, updated_at: now.toISOString() })
          .eq("id", activeRec.id);
      }

      return new Response(JSON.stringify({
        success: true,
        certificate: certPayload,
        signature,
        is_valid: isValid,
        remaining_days: remainingDays,
        features,
        min_supported_version: String(globalCfg?.min_supported_version || "10.0.0"),
        support_whatsapp: String(globalCfg?.support_whatsapp || ""),
        force_update_message: String(globalCfg?.force_update_message || ""),
        announcement_message: String(globalCfg?.announcement_message || ""),
        announcement_active: Boolean(globalCfg?.announcement_active),
        custom_notice: String(activeRec.custom_notice || ""),
        remote_command: pendingRemoteCommand,
        read_only_mode: readOnlyMode,
        read_only_until: readOnlyUntilIso,
        max_desktop_users: Number(activeRec.max_desktop_users || 0),
        force_update_target: Boolean(activeRec.force_update_target),
        server_time: now.toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "report_error") {
      const companyId = String(body.company_id || "").trim() || null;
      const deviceId = String(body.device_id || "").trim() || null;
      const companyName = String(body.company_name || "عميل").trim();
      const desktopVersion = String(body.desktop_version || "10.1.0").trim();
      const severity = String(body.severity || "error").trim();
      const mod = String(body.module || "sync").trim();
      const errorMessage = String(body.error_message || "Unknown error").trim();
      const errorDetails = body.error_details && typeof body.error_details === "object" ? body.error_details : {};

      await supabase.from("client_error_logs").insert({
        company_id: companyId,
        device_id: deviceId,
        company_name: companyName,
        desktop_version: desktopVersion,
        severity,
        module: mod,
        error_message: errorMessage,
        error_details: errorDetails
      });

      try {
        const { data: tgCfg } = await supabase
          .from("app_global_config")
          .select("telegram_bot_token, telegram_chat_id, telegram_alerts_enabled")
          .eq("id", 1)
          .maybeSingle();
        if (tgCfg?.telegram_alerts_enabled && tgCfg?.telegram_bot_token && tgCfg?.telegram_chat_id) {
          const lower = errorMessage.toLowerCase();
          const diagTitle = lower.includes("timestamp expired") || lower.includes("clock out of sync")
            ? "ساعة جهاز العميل غير مضبوطة"
            : lower.includes("is not unique") || lower.includes("apply_delta_sync_batch")
              ? "تعارض في دالة المزامنة السحابية"
              : lower.includes("unauthorized_device") || lower.includes("invalid signature")
                ? "عدم تطابق هوية أو توقيع الجهاز"
                : lower.includes("failed to fetch") || lower.includes("enotfound") || lower.includes("etimedout") || lower.includes("network")
                  ? "انقطاع الإنترنت أو تعذر الوصول للخادم"
                  : "خطأ تقني أثناء التشغيل";
          const diagSolution = lower.includes("timestamp expired") || lower.includes("clock out of sync")
            ? "اطلب من العميل تفعيل الضبط التلقائي للوقت في ويندوز."
            : lower.includes("unauthorized_device")
              ? "استخدم زر (فك جهاز) من لوحة الإدارة."
              : "راجع تبويب سجل أخطاء العملاء في لوحة الإدارة.";

          const text =
            `<b>🚨 تنبيه خطأ لدى عميل</b>\n` +
            `• الشركة: <b>${companyName}</b> (v${desktopVersion})\n` +
            `• القسم: ${mod}\n` +
            `• المشكلة: <b>${diagTitle}</b>\n` +
            `• الحل المقترح: ${diagSolution}\n` +
            `• التفاصيل: <code>${errorMessage.slice(0, 220)}</code>`;

          fetch(`https://api.telegram.org/bot${tgCfg.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: tgCfg.telegram_chat_id,
              text,
              parse_mode: "HTML"
            })
          }).catch(() => {});
        }
      } catch (_) {}

      return new Response(JSON.stringify({ success: true }), {
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
      const features = (renewed.features && typeof renewed.features === "object" && !Array.isArray(renewed.features))
        ? renewed.features
        : {};

      return new Response(JSON.stringify({
        success: true,
        message: "تم تفعيل وتجديد الاشتراك بنجاح",
        certificate: certPayload,
        signature,
        is_valid: true,
        expires_at: newExpiry.toISOString(),
        features,
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

    if (action === "poll_notices") {
      const companyId = String(body.company_id || "").trim();
      const now = new Date();
      const nowIso = now.toISOString();
      let customNotice = "";
      let readOnlyMode = false;
      let readOnlyUntilIso = "";
      let maxDesktopUsers = 0;
      let forceUpdateTarget = false;
      let pendingRemoteCommand: string | null = null;
      let licenseStatusOut = "";

      if (companyId) {
        const { data: rec } = await supabase
          .from("client_licenses")
          .select("id, custom_notice, license_status, read_only_until, max_desktop_users, force_update_target, remote_command")
          .eq("company_id", companyId)
          .maybeSingle();
        if (rec) {
          customNotice = String(rec.custom_notice || "");
          maxDesktopUsers = Number(rec.max_desktop_users || 0);
          forceUpdateTarget = Boolean(rec.force_update_target);
          pendingRemoteCommand = rec.remote_command ? String(rec.remote_command) : null;
          licenseStatusOut = String(rec.license_status || "");
          readOnlyUntilIso = rec.read_only_until ? String(rec.read_only_until) : "";

          const pollUpdates: Record<string, unknown> = { last_heartbeat_at: nowIso };
          if (pendingRemoteCommand) {
            pollUpdates.remote_command = null;
          }
          if (licenseStatusOut === "read_only") {
            const roMs = readOnlyUntilIso ? new Date(readOnlyUntilIso).getTime() : 0;
            if (roMs > now.getTime()) {
              readOnlyMode = true;
            } else {
              licenseStatusOut = "suspended";
              pollUpdates.license_status = "suspended";
              pollUpdates.updated_at = nowIso;
            }
          }
          await supabase
            .from("client_licenses")
            .update(pollUpdates)
            .eq("id", rec.id);
        }
      }
      const { data: globalCfg } = await supabase
        .from("app_global_config")
        .select("announcement_message, announcement_active, min_supported_version, force_update_message")
        .eq("id", 1)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        custom_notice: customNotice,
        announcement_message: String(globalCfg?.announcement_message || ""),
        announcement_active: Boolean(globalCfg?.announcement_active),
        min_supported_version: String(globalCfg?.min_supported_version || "10.0.0"),
        force_update_message: String(globalCfg?.force_update_message || ""),
        read_only_mode: readOnlyMode,
        read_only_until: readOnlyUntilIso,
        license_status: licenseStatusOut,
        max_desktop_users: maxDesktopUsers,
        force_update_target: forceUpdateTarget,
        remote_command: pendingRemoteCommand,
        server_time: nowIso
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "report_security_alert") {
      const alertType = String(body.alert_type || "CLOCK_TAMPERING").trim();
      const companyName = String(body.company_name || companyId).trim();
      const details = String(body.details || "").trim();
      await supabase.from("client_error_logs").insert({
        company_id: companyId,
        device_id: rawMachineId || null,
        company_name: companyName,
        desktop_version: desktopVersion,
        severity: "critical",
        module: "security",
        error_message: `[${alertType}] ${details || "نشاط أمني مشبوه"}`
      });
      try {
        const { data: tgCfg } = await supabase
          .from("app_global_config")
          .select("telegram_alerts_enabled, telegram_bot_token, telegram_chat_id")
          .eq("id", 1)
          .maybeSingle();
        if (tgCfg?.telegram_alerts_enabled && tgCfg?.telegram_bot_token && tgCfg?.telegram_chat_id) {
          const title = alertType === "CLOCK_TAMPERING"
            ? "🚨 تحذير أمني: تلاعب بساعة النظام (Clock Tampering)"
            : `🚨 تحذير أمني (${alertType})`;
          const msg =
            `<b>${title}</b>\n` +
            `• الشركة: <b>${companyName}</b>\n` +
            `• الجهاز: <code>${rawMachineId || "—"}</code>\n` +
            `• التفاصيل: ${details || "تم رصد رجوع ساعة النظام للخلف"}`;
          fetch(`https://api.telegram.org/bot${tgCfg.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgCfg.telegram_chat_id, text: msg, parse_mode: "HTML" })
          }).catch(() => {});
        }
      } catch (_) {}
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "submit_support_ticket") {
      const subject = String(body.subject || "").trim();
      const message = String(body.message || "").trim();
      const companyName = String(body.company_name || companyId).trim();
      const recentErrors = String(body.recent_errors || "").trim();
      if (!subject || !message) {
        return new Response(JSON.stringify({ success: false, error: "يرجى كتابة عنوان وتفاصيل المشكلة." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const { data: ticket, error: ticketErr } = await supabase
        .from("support_tickets")
        .insert({
          company_id: companyId,
          company_name: companyName,
          desktop_version: desktopVersion,
          machine_id: rawMachineId || null,
          subject,
          message,
          recent_errors: recentErrors || null,
          status: "open"
        })
        .select("id, created_at")
        .single();
      if (ticketErr) {
        return new Response(JSON.stringify({ success: false, error: ticketErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      try {
        const { data: tgCfg } = await supabase
          .from("app_global_config")
          .select("telegram_alerts_enabled, telegram_bot_token, telegram_chat_id")
          .eq("id", 1)
          .maybeSingle();
        if (tgCfg?.telegram_alerts_enabled && tgCfg?.telegram_bot_token && tgCfg?.telegram_chat_id) {
          const msg =
            `<b>🎫 تذكرة دعم فني جديدة</b>\n` +
            `• الشركة: <b>${companyName}</b> (v${desktopVersion})\n` +
            `• الموضوع: <b>${subject}</b>\n` +
            `• الرسالة: ${message.slice(0, 350)}`;
          fetch(`https://api.telegram.org/bot${tgCfg.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgCfg.telegram_chat_id, text: msg, parse_mode: "HTML" })
          }).catch(() => {});
        }
      } catch (_) {}
      return new Response(JSON.stringify({ success: true, ticket }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "mark_notices_read") {
      const companyId = String(body.company_id || "").trim();
      const noticeIds: string[] = Array.isArray(body.notice_ids)
        ? body.notice_ids.map((x: unknown) => String(x || "").trim()).filter(Boolean)
        : [];
      if (!companyId || !noticeIds.length) {
        return new Response(JSON.stringify({ success: true, updated: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const idSet = new Set(noticeIds);
      const nowIso = new Date().toISOString();
      const parseList = (raw: unknown): Array<Record<string, any>> => {
        const s = String(raw || "").trim();
        if (!s) return [];
        if (s.startsWith("[")) {
          try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr)) return arr;
          } catch (_) {}
        }
        return [{ id: `legacy_${s.length}`, text: s, created_at: null, read_at: null }];
      };

      let clientCompanyName = String(body.company_name || "").trim();
      const newlyReadPrivateTexts: string[] = [];

      const { data: rec } = await supabase
        .from("client_licenses")
        .select("id, company_name, custom_notice")
        .eq("company_id", companyId)
        .maybeSingle();

      if (rec) {
        clientCompanyName = String(rec.company_name || clientCompanyName || companyId).trim();
        const privList = parseList(rec.custom_notice);
        let privChanged = false;
        for (const item of privList) {
          if (item && idSet.has(String(item.id || "")) && !item.read_at) {
            item.read_at = nowIso;
            privChanged = true;
            newlyReadPrivateTexts.push(String(item.text || "").slice(0, 120));
          }
        }
        if (privChanged) {
          await supabase
            .from("client_licenses")
            .update({ custom_notice: JSON.stringify(privList), updated_at: nowIso })
            .eq("id", rec.id);
        }
      }

      const { data: globalCfg } = await supabase
        .from("app_global_config")
        .select("announcement_message, telegram_alerts_enabled, telegram_bot_token, telegram_chat_id")
        .eq("id", 1)
        .maybeSingle();

      const newlyReadGlobalTexts: string[] = [];
      if (globalCfg && globalCfg.announcement_message) {
        const annList = parseList(globalCfg.announcement_message);
        let annChanged = false;
        for (const item of annList) {
          if (item && idSet.has(String(item.id || ""))) {
            const readBy: Array<Record<string, any>> = Array.isArray(item.read_by) ? item.read_by : [];
            if (!readBy.some((r) => String(r?.company_id || "") === companyId)) {
              readBy.push({
                company_id: companyId,
                company_name: clientCompanyName || companyId,
                read_at: nowIso
              });
              item.read_by = readBy;
              annChanged = true;
              newlyReadGlobalTexts.push(String(item.text || "").slice(0, 120));
            }
          }
        }
        if (annChanged) {
          await supabase
            .from("app_global_config")
            .update({ announcement_message: JSON.stringify(annList) })
            .eq("id", 1);
        }
      }

      if (
        (newlyReadPrivateTexts.length > 0 || newlyReadGlobalTexts.length > 0) &&
        globalCfg?.telegram_alerts_enabled &&
        globalCfg?.telegram_bot_token &&
        globalCfg?.telegram_chat_id
      ) {
        try {
          const lines: string[] = [`👁️ تم قراءة الإشعار بواسطة العميل:\n🏢 ${clientCompanyName}`];
          if (newlyReadPrivateTexts.length > 0) {
            lines.push(`🔔 إشعار خاص:\n• ${newlyReadPrivateTexts.join("\n• ")}`);
          }
          if (newlyReadGlobalTexts.length > 0) {
            lines.push(`📢 إعلان عام:\n• ${newlyReadGlobalTexts.join("\n• ")}`);
          }
          await fetch(`https://api.telegram.org/bot${globalCfg.telegram_bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: globalCfg.telegram_chat_id, text: lines.join("\n") })
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true, updated: newlyReadPrivateTexts.length }), {
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
