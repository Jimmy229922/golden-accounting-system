import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MASTER_KEY_RAW = Deno.env.get("LEGACY_ACTIVATION_KEY") || "AX-2026-MK-7F4B9C3E-PLN7-TS9X-SECURE-8831";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatActivationCode(rawHex16: string): string {
  const clean = rawHex16.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  return clean.match(/.{1,4}/g)?.join("-") || clean;
}

async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, status: 401, error: "يرجى تسجيل الدخول أولاً." };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى." };
  }

  const role = String(data.user.app_metadata?.role || "").trim().toLowerCase();
  if (role !== "super_admin") {
    return { ok: false, status: 403, error: "غير مصرح لك بالدخول إلى لوحة التحكم الإدارية." };
  }

  return { ok: true, user: data.user };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const authCheck = await verifySuperAdmin(req);
  if (!authCheck.ok) {
    return jsonResponse({ success: false, error: authCheck.error }, authCheck.status);
  }

  try {
    const body = await req.json();
    const action = String(body.action || "").trim();

    if (action === "dashboard_overview") {
      const [licRes, devRes, usersRes, cfgRes] = await Promise.all([
        supabase
          .from("client_licenses")
          .select("*")
          .order("last_heartbeat_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("mobile_devices")
          .select("id, company_id, device_name, is_active, last_heartbeat_at"),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabase
          .from("app_global_config")
          .select("*")
          .eq("id", 1)
          .maybeSingle()
      ]);

      if (licRes.error) {
        return jsonResponse({ success: false, error: licRes.error.message }, 500);
      }

      const licenses = licRes.data || [];
      const devices = devRes.data || [];
      const authUsers = usersRes.data?.users || [];

      const devicesByCompany: Record<string, any[]> = {};
      for (const dev of devices) {
        const cid = String(dev.company_id || "");
        if (!devicesByCompany[cid]) devicesByCompany[cid] = [];
        devicesByCompany[cid].push(dev);
      }

      const androidUsersByCompany: Record<string, any[]> = {};
      for (const u of authUsers) {
        const uRole = String(u.app_metadata?.role || "");
        const cid = String(u.app_metadata?.company_id || "");
        if (!cid || uRole === "super_admin") continue;
        if (!androidUsersByCompany[cid]) androidUsersByCompany[cid] = [];
        androidUsersByCompany[cid].push({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          role: uRole || "mobile_reader"
        });
      }

      const nowMs = Date.now();
      const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
      const stats = {
        total: licenses.length,
        active: 0,
        trial: 0,
        lifetime: 0,
        suspended: 0,
        expired: 0,
        onlineToday: 0
      };

      const clients = licenses.map((lic: any) => {
        const status = String(lic.license_status || "trial");
        const expMs = lic.expires_at ? new Date(lic.expires_at).getTime() : 0;
        const isLifetime = status === "lifetime";
        const isSuspended = status === "suspended";
        const isExpired = !isLifetime && !isSuspended && expMs > 0 && expMs <= nowMs;
        const remainingDays = isLifetime
          ? 99999
          : expMs > 0
            ? Math.max(0, Math.ceil((expMs - nowMs) / 86400000))
            : 0;

        if (isLifetime) stats.lifetime++;
        else if (isSuspended) stats.suspended++;
        else if (isExpired) stats.expired++;
        else if (status === "trial") stats.trial++;
        else stats.active++;

        const hbMs = lic.last_heartbeat_at ? new Date(lic.last_heartbeat_at).getTime() : 0;
        if (hbMs >= oneDayAgoMs) stats.onlineToday++;

        const cid = String(lic.company_id || "");
        return {
          ...lic,
          computed_status: isSuspended ? "suspended" : isLifetime ? "lifetime" : isExpired ? "expired" : status,
          remaining_days: remainingDays,
          features: (lic.features && typeof lic.features === "object" && !Array.isArray(lic.features)) ? lic.features : {},
          devices: devicesByCompany[cid] || [],
          android_users: androidUsersByCompany[cid] || []
        };
      });

      return jsonResponse({
        success: true,
        admin_email: authCheck.user.email,
        global_config: cfgRes?.data || {
          min_supported_version: "10.0.0",
          support_whatsapp: "",
          force_update_message: "يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك."
        },
        stats,
        clients
      });
    }

    if (action === "update_company_name") {
      const licenseId = String(body.license_id || "").trim();
      const companyId = String(body.company_id || "").trim();
      const companyName = String(body.company_name || "").trim();
      if (!licenseId || companyName.length < 2) {
        return jsonResponse({ success: false, error: "يرجى إدخال اسم شركة صالح (حرفين على الأقل)." }, 400);
      }

      const { error: licErr } = await supabase
        .from("client_licenses")
        .update({ company_name: companyName, updated_at: new Date().toISOString() })
        .eq("id", licenseId);

      if (licErr) return jsonResponse({ success: false, error: licErr.message }, 500);

      if (companyId) {
        await supabase
          .from("mobile_companies")
          .update({ name: companyName, updated_at: new Date().toISOString() })
          .eq("id", companyId);
      }

      return jsonResponse({ success: true });
    }

    if (action === "update_features") {
      const licenseId = String(body.license_id || "").trim();
      const features = body.features;
      if (!licenseId || !features || typeof features !== "object" || Array.isArray(features)) {
        return jsonResponse({ success: false, error: "بيانات الميزات غير صالحة." }, 400);
      }

      const { error } = await supabase
        .from("client_licenses")
        .update({ features, updated_at: new Date().toISOString() })
        .eq("id", licenseId);

      if (error) return jsonResponse({ success: false, error: error.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "update_license") {
      const licenseId = String(body.license_id || "").trim();
      const mode = String(body.mode || "").trim();
      if (!licenseId || !mode) {
        return jsonResponse({ success: false, error: "بيانات التحديث ناقصة." }, 400);
      }

      const { data: current, error: fetchErr } = await supabase
        .from("client_licenses")
        .select("*")
        .eq("id", licenseId)
        .single();

      if (fetchErr || !current) {
        return jsonResponse({ success: false, error: "العميل غير موجود." }, 404);
      }

      const now = new Date();
      const updates: Record<string, unknown> = { updated_at: now.toISOString() };

      if (mode === "extend_days") {
        const days = Math.max(1, Math.min(3650, Number(body.days) || 30));
        const currentExp = current.expires_at ? new Date(current.expires_at) : now;
        const baseDate = currentExp.getTime() > now.getTime() && current.license_status !== "lifetime" ? currentExp : now;
        const newExpiry = new Date(baseDate.getTime() + days * 86400000);
        updates.license_status = "active";
        updates.expires_at = newExpiry.toISOString();
        updates.renew_count = Number(current.renew_count || 0) + 1;
      } else if (mode === "set_expiry") {
        const expDate = new Date(String(body.expires_at || ""));
        if (Number.isNaN(expDate.getTime())) {
          return jsonResponse({ success: false, error: "تاريخ الانتهاء غير صالح." }, 400);
        }
        updates.license_status = "active";
        updates.expires_at = expDate.toISOString();
      } else if (mode === "lifetime") {
        updates.license_status = "lifetime";
        updates.expires_at = "2099-12-31T23:59:59.000Z";
      } else if (mode === "suspend") {
        updates.license_status = "suspended";
      } else if (mode === "resume") {
        const expMs = current.expires_at ? new Date(current.expires_at).getTime() : 0;
        updates.license_status = expMs > now.getTime() ? "active" : "trial";
        if (expMs <= now.getTime()) {
          updates.expires_at = new Date(now.getTime() + 15 * 86400000).toISOString();
        }
      } else if (mode === "reset_machine") {
        updates.bound_machine_id = null;
      } else if (mode === "update_notes") {
        updates.notes = String(body.notes || "").trim();
      } else {
        return jsonResponse({ success: false, error: "وضع التحديث غير معروف." }, 400);
      }

      const { error: updErr } = await supabase
        .from("client_licenses")
        .update(updates)
        .eq("id", licenseId);

      if (updErr) return jsonResponse({ success: false, error: updErr.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "create_android_user") {
      const companyId = String(body.company_id || "").trim();
      const companyName = String(body.company_name || "مؤسسة").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!companyId || !email || !email.includes("@")) {
        return jsonResponse({ success: false, error: "يرجى إدخال بريد إلكتروني صحيح ومعرّف شركة." }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }, 400);
      }

      const code = companyId.replace(/-/g, "").slice(0, 8);
      await supabase
        .from("mobile_companies")
        .upsert(
          { id: companyId, code, name: companyName, currency_code: "EGP", is_active: true },
          { onConflict: "id" }
        );

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          company_id: companyId,
          role: "mobile_reader"
        },
        user_metadata: {
          display_name: companyName
        }
      });

      if (createErr || !created?.user) {
        return jsonResponse({ success: false, error: createErr?.message || "تعذر إنشاء حساب الأندرويد." }, 400);
      }

      return jsonResponse({
        success: true,
        user: {
          id: created.user.id,
          email: created.user.email,
          company_id: companyId
        }
      });
    }

    if (action === "reset_android_password") {
      const userId = String(body.user_id || "").trim();
      const password = String(body.password || "");
      if (!userId || password.length < 6) {
        return jsonResponse({ success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." }, 400);
      }

      const { data: targetRes } = await supabase.auth.admin.getUserById(userId);
      if (targetRes?.user?.app_metadata?.role === "super_admin") {
        return jsonResponse({ success: false, error: "لا يمكن تعديل حساب السوبر أدمن من هنا." }, 403);
      }

      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === "delete_android_user") {
      const userId = String(body.user_id || "").trim();
      if (!userId) return jsonResponse({ success: false, error: "معرّف المستخدم مطلوب." }, 400);

      const { data: targetRes } = await supabase.auth.admin.getUserById(userId);
      if (targetRes?.user?.app_metadata?.role === "super_admin") {
        return jsonResponse({ success: false, error: "لا يمكن حذف حساب السوبر أدمن." }, 403);
      }

      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === "generate_activation_code") {
      const machineId = String(body.machine_id || "").trim();
      if (!machineId) {
        return jsonResponse({ success: false, error: "رقم الجهاز (Machine ID) مطلوب." }, 400);
      }
      const hmac = await hmacSha256(MASTER_KEY_RAW, machineId);
      const code = formatActivationCode(hmac.substring(0, 16));
      return jsonResponse({ success: true, machine_id: machineId, activation_code: code });
    }

    if (action === "update_global_config") {
      const minVersion = String(body.min_supported_version || "10.0.0").trim() || "10.0.0";
      const supportWhatsapp = String(body.support_whatsapp || "").trim().replace(/[^0-9+]/g, "");
      const forceMsg = String(body.force_update_message || "يرجى تحديث البرنامج إلى أحدث إصدار للمتابعة وضمان استقرار بياناتك.").trim();

      const { error } = await supabase
        .from("app_global_config")
        .upsert({
          id: 1,
          min_supported_version: minVersion,
          support_whatsapp: supportWhatsapp,
          force_update_message: forceMsg,
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (error) return jsonResponse({ success: false, error: error.message }, 500);
      return jsonResponse({ success: true });
    }

    if (action === "change_my_password") {
      const newPassword = String(body.new_password || "");
      if (newPassword.length < 6) {
        return jsonResponse({ success: false, error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل." }, 400);
      }

      const { error } = await supabase.auth.admin.updateUserById(authCheck.user.id, { password: newPassword });
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === "get_error_logs") {
      const { data, error } = await supabase
        .from("client_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) return jsonResponse({ success: false, error: error.message }, 500);
      return jsonResponse({ success: true, logs: data || [] });
    }

    return jsonResponse({ success: false, error: "إجراء غير معروف." }, 400);
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "خطأ داخلي في الخادم." }, 500);
  }
});
