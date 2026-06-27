import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recognizeFood, scaleNutrients } from "@/lib/recognition.server";

// Smart Deck device ingest endpoint.
// POST /api/public/ingest
// Headers: x-device-token: <plaintext token from settings>
// Body (JSON): { weights: [w1,w2,w3,w4], depth_mm, captured_at?, image_base64? (data url or raw base64) }
// Returns: { ok, meal_id, top_label, top_confidence, calories, nutrients }

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const bodySchema = z.object({
  weights: z.array(z.number().nonnegative()).length(4),
  depth_mm: z.number().nonnegative().optional(),
  captured_at: z.string().datetime().optional(),
  image_base64: z.string().optional(), // optional for now; recommended
  image_mime: z.string().regex(/^image\/(jpeg|png|webp)$/).default("image/jpeg"),
});

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-device-token",
          },
        }),
      POST: async ({ request }) => {
        const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
        const token = request.headers.get("x-device-token");
        if (!token) return new Response(JSON.stringify({ error: "missing x-device-token" }), { status: 401, headers: cors });

        const tokenHash = await sha256Hex(token);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: device, error: dErr } = await supabaseAdmin
          .from("devices")
          .select("id, user_id")
          .eq("token_hash", tokenHash)
          .single();
        if (dErr || !device) return new Response(JSON.stringify({ error: "invalid device token" }), { status: 401, headers: cors });

        let json: unknown;
        try { json = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: cors }); }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid body", issues: parsed.error.issues }), { status: 400, headers: cors });
        }
        const body = parsed.data;
        const total_weight_grams = body.weights.reduce((a, b) => a + b, 0);

        // Upload image if provided
        let image_path: string | null = null;
        let imageBytes: Uint8Array | undefined;
        if (body.image_base64) {
          imageBytes = decodeBase64(body.image_base64);
          const ext = body.image_mime === "image/png" ? "png" : body.image_mime === "image/webp" ? "webp" : "jpg";
          const path = `${device.user_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("meal-images")
            .upload(path, imageBytes, { contentType: body.image_mime, upsert: false });
          if (!upErr) image_path = path;
        }

        // Recognition (stub until LogMeal is wired)
        let top_label: string | null = null;
        let top_confidence: number | null = null;
        let predictions: unknown = null;
        let calories: number | null = null;
        let nutrients: Record<string, number> | null = null;
        let status: "processed" | "failed" = "processed";
        let errMsg: string | null = null;
        try {
          const r = await recognizeFood(imageBytes);
          top_label = r.top_label;
          top_confidence = r.top_confidence;
          predictions = r.predictions;
          if (total_weight_grams > 0) {
            const scaled = scaleNutrients(r, total_weight_grams);
            calories = scaled.calories;
            nutrients = scaled.nutrients;
          }
        } catch (e) {
          status = "failed";
          errMsg = (e as Error).message;
        }

        const { data: meal, error: mErr } = await supabaseAdmin
          .from("meals")
          .insert({
            user_id: device.user_id,
            device_id: device.id,
            image_path,
            weights_grams: body.weights,
            total_weight_grams,
            depth_mm: body.depth_mm ?? null,
            captured_at: body.captured_at ?? new Date().toISOString(),
            predictions,
            top_label,
            top_confidence,
            calories,
            nutrients,
            status,
            error: errMsg,
          })
          .select("id")
          .single();
        if (mErr) return new Response(JSON.stringify({ error: mErr.message }), { status: 500, headers: cors });

        await supabaseAdmin.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

        return new Response(
          JSON.stringify({ ok: true, meal_id: meal.id, top_label, top_confidence, calories, nutrients }),
          { status: 200, headers: cors },
        );
      },
    },
  },
});
