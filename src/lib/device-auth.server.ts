// Server-only helper: verifies a Raspberry Pi device bearer token against
// the SHA-256 hash stored in `devices.token_hash`. Returns the matching
// device row (id, user_id) or null when invalid.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyDeviceToken(
  request: Request,
): Promise<{ id: string; user_id: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const token_hash = await sha256Hex(token);
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, user_id")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export const DEVICE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;
