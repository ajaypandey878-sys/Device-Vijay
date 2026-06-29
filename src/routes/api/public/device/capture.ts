// POST /api/public/device/capture — Raspberry Pi uploads a captured frame.
// Body: { image_base64: string, weight?: number, session_id?: string }
// Effect: uploads image to `meal-images/<user_id>/<timestamp>.jpg` and inserts
// a meal row with status='captured' and locked_weight_grams=weight.
// Food detection + calorie calc are intentionally disabled.
import { createFileRoute } from "@tanstack/react-router";
import { DEVICE_CORS_HEADERS, verifyDeviceToken } from "@/lib/device-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...DEVICE_CORS_HEADERS },
  });
}

function decodeBase64(input: string): Uint8Array {
  const base64 = input.includes(",") ? input.split(",")[1] : input;
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const Route = createFileRoute("/api/public/device/capture")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: DEVICE_CORS_HEADERS }),
      POST: async ({ request }) => {
        const device = await verifyDeviceToken(request);
        if (!device) return json({ error: "Unauthorized" }, 401);
        let payload: { image_base64?: unknown; weight?: unknown } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        if (typeof payload.image_base64 !== "string" || !payload.image_base64) {
          return json({ error: "image_base64 is required" }, 400);
        }
        const weight = Number(payload.weight);
        const lockedWeight = Number.isFinite(weight) ? weight : null;

        const bytes = decodeBase64(payload.image_base64);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const path = `${device.user_id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("meal-images")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (upErr) return json({ error: upErr.message }, 500);

        const { data: meal, error: mealErr } = await supabaseAdmin
          .from("meals")
          .insert({
            user_id: device.user_id,
            device_id: device.id,
            image_path: path,
            locked_weight_grams: lockedWeight,
            total_weight_grams: lockedWeight,
            weights_grams: lockedWeight != null ? [lockedWeight] : [],
            status: "captured",
          })
          .select("id")
          .single();
        if (mealErr) return json({ error: mealErr.message }, 500);

        await supabaseAdmin
          .from("devices")
          .update({ status: "online", last_seen_at: new Date().toISOString() })
          .eq("id", device.id);

        return json({ ok: true, meal_id: meal.id, image_path: path });
      },
    },
  },
});
