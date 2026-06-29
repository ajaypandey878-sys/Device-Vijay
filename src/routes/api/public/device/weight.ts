// POST /api/public/device/weight — Raspberry Pi streams load-cell weight.
// Body: { weight: number, session_id?: string }
// Placeholder: records the latest reading on the device row (last_seen_at +
// status=online). Persistent weight history is not stored yet — the dashboard
// reads live weight via the polling URL configured separately.
import { createFileRoute } from "@tanstack/react-router";
import { DEVICE_CORS_HEADERS, verifyDeviceToken } from "@/lib/device-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...DEVICE_CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/device/weight")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: DEVICE_CORS_HEADERS }),
      POST: async ({ request }) => {
        const device = await verifyDeviceToken(request);
        if (!device) return json({ error: "Unauthorized" }, 401);
        let payload: { weight?: unknown; session_id?: unknown } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const weight = Number(payload.weight);
        if (!Number.isFinite(weight)) return json({ error: "weight must be a number" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("devices")
          .update({ status: "online", last_seen_at: new Date().toISOString() })
          .eq("id", device.id);

        // Placeholder: stabilization & locking happens client-side for now.
        return json({ ok: true, weight, device_id: device.id });
      },
    },
  },
});
