import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const MAX_TIME_DRIFT_MS = 300000;
const BUCKET_NAME = Deno.env.get("SUPABASE_BACKUP_BUCKET") || "client-backups";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id, x-timestamp, x-nonce, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sanitizeFileName(name: string): string {
  return String(name || "backup.db").replace(/[^a-zA-Z0-9._-]/g, "_");
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
    const deviceId = req.headers.get("x-device-id");
    const timestampStr = req.headers.get("x-timestamp");
    const nonce = req.headers.get("x-nonce");
    const signatureBase64 = req.headers.get("x-signature");

    if (!deviceId || !timestampStr || !nonce || !signatureBase64) {
      return new Response(JSON.stringify({ error: "Missing authentication headers" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const requestTime = new Date(timestampStr).getTime();
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_TIME_DRIFT_MS) {
      return new Response(JSON.stringify({ error: "Timestamp expired or clock out of sync", server_time: new Date().toISOString() }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: device, error: devError } = await supabase
      .from("mobile_devices")
      .select("company_id, public_key, is_active")
      .eq("id", deviceId)
      .single();

    if (devError || !device || !device.is_active) {
      return new Response(JSON.stringify({ error: "Device revoked or unauthorized", server_time: new Date().toISOString() }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const verifiedCompanyId = device.company_id;

    const { data: company, error: compError } = await supabase
      .from("mobile_companies")
      .select("is_active, name")
      .eq("id", verifiedCompanyId)
      .single();

    if (compError || !company || !company.is_active) {
      return new Response(JSON.stringify({ error: "Company suspended or inactive", server_time: new Date().toISOString() }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const rawBody = await req.text();

    const rawPublicKey = decodeBase64(device.public_key);
    const rawSignature = decodeBase64(signatureBase64);
    const canonicalMessage = new TextEncoder().encode(`${timestampStr}.${nonce}.${verifiedCompanyId}.${rawBody}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawPublicKey as any,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify("Ed25519", cryptoKey, rawSignature as any, canonicalMessage);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid cryptographic signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { error: nonceError } = await supabase
      .from("mobile_sync_nonces")
      .insert({ nonce, device_id: deviceId });

    if (nonceError) {
      return new Response(JSON.stringify({ error: "Replay attack detected: Nonce already used" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.parse(rawBody || "{}");
    const action = String(payload.action || "").trim();

    if (action === "get_upload_url") {
      const fileName = sanitizeFileName(payload.file_name || "backup.db");
      const dateObj = new Date();
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getDate()).padStart(2, "0");
      const objectPath = `clients/${verifiedCompanyId}/${y}/${m}/${d}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUploadUrl(objectPath);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        signed_url: data.signedUrl,
        token: data.token,
        path: data.path,
        bucket: BUCKET_NAME,
        server_time: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "list") {
      const companyFolder = `clients/${verifiedCompanyId}`;
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(companyFolder, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" }
        });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        files: data || [],
        folder: companyFolder,
        server_time: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_download_url") {
      const targetPath = String(payload.path || "").trim();
      const allowedPrefix = `clients/${verifiedCompanyId}/`;

      if (!targetPath.startsWith(allowedPrefix)) {
        return new Response(JSON.stringify({ error: "Access denied to requested object path" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(targetPath, 300);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        signed_url: data.signedUrl,
        server_time: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown backup action" }), {
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
