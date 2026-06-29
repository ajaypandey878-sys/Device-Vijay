// POST /api/public/device/connect — Raspberry Pi heartbeat.
// Auth: `Authorization: Bearer <device-token>`.
// Effect: marks the device row online and bumps last_seen_at.
// Pi should call this every 5 seconds.
import { createFileRoute } from "@tanstack/react-router";
import { DEVICE_CORS_HEADERS, verifyDeviceToken } from "@/lib/device-auth.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...DEVICE_CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/public/device/connect")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: DEVICE_CORS_HEADERS }),
      POST: async ({ request }) => {
        const device = await verifyDeviceToken(request);
        if (!device) return json({ error: "Unauthorized" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("devices")
          .update({ status: "online", last_seen_at: new Date().toISOString() })
          .eq("id", device.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, device_id: device.id, status: "online" });
      },
    },
  },
});
