import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDevices, createDevice, deleteDevice } from "@/lib/devices.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Smart Deck" }] }),
  component: Settings,
});

function Settings() {
  const fetchDevices = useServerFn(listDevices);
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices({}),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage devices that send meals to your account.</p>
      </div>

      <Card><CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Smart Deck devices</h2>
            <p className="text-sm text-muted-foreground">Each Raspberry Pi uses a device token to upload meals.</p>
          </div>
          <NewDeviceDialog />
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (devices ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No devices yet. Add your first one to get a token.</p>
          )}
          {(devices ?? []).map((d) => <DeviceRow key={d.id} device={d} />)}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <h2 className="font-semibold">How your Pi uploads a meal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a POST to <code className="rounded bg-secondary px-1.5 py-0.5">/api/public/ingest</code> with header
          <code className="ml-1 rounded bg-secondary px-1.5 py-0.5">x-device-token: &lt;your token&gt;</code> and a JSON body:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
{`{
  "weights": [w1, w2, w3, w4],   // grams from each HX711
  "depth_mm": 47.2,              // ToF reading
  "captured_at": "2026-06-27T15:00:00Z",
  "image_base64": "<jpeg base64>",
  "image_mime": "image/jpeg"
}`}
        </pre>
      </CardContent></Card>
    </div>
  );
}

function DeviceRow({ device }: { device: any }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteDevice);
  const mutation = useMutation({
    mutationFn: () => del({ data: { id: device.id } }),
    onSuccess: () => { toast.success("Device removed"); qc.invalidateQueries({ queryKey: ["devices"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{device.name}</p>
        <p className="text-xs text-muted-foreground">
          <code>{device.token_prefix}…</code>
          {device.last_seen_at ? ` • last seen ${formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}` : " • never connected"}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this device? Its uploads will stop working.")) mutation.mutate(); }}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function NewDeviceDialog() {
  const qc = useQueryClient();
  const create = useServerFn(createDevice);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Kitchen Deck");
  const [token, setToken] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => create({ data: { name: name.trim() } }),
    onSuccess: (res) => { setToken(res.token); qc.invalidateQueries({ queryKey: ["devices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function reset() { setToken(null); setName("Kitchen Deck"); setOpen(false); }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else setOpen(v); }}>
      <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add device</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{token ? "Save your device token" : "Add a Smart Deck"}</DialogTitle>
        </DialogHeader>
        {!token ? (
          <div className="space-y-3">
            <Label htmlFor="dname">Device name</Label>
            <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} />
            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Cancel</Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
                {mutation.isPending ? "Creating…" : "Create token"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border bg-secondary/60 p-3 text-sm">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This token is shown only once. Copy it into your Pi config now.</p>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={token} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(token); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="outline">Header: x-device-token</Badge>
            <DialogFooter>
              <Button onClick={reset}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
