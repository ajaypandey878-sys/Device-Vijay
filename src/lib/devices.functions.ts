import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Devices: each Pi gets a long random token. Only the SHA-256 hash is stored.
// The plaintext token is returned ONCE at creation time so the user can paste it
// into the Pi's config.

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "sdk_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devices")
      .select("id, name, token_prefix, last_seen_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => z.object({ name: z.string().trim().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const token = randomToken();
    const token_hash = await sha256Hex(token);
    const token_prefix = token.slice(0, 12);
    const { data: row, error } = await context.supabase
      .from("devices")
      .insert({ user_id: context.userId, name: data.name, token_hash, token_prefix })
      .select("id, name, token_prefix, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { device: row, token }; // plaintext token returned ONCE
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
