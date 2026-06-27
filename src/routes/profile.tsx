import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDevices, createDevice, deleteDevice } from "@/lib/devices.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";

export const Route = createFileRoute("/profile")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Profile — Smart Deck" }] }),
  component: () => <AppShell><Profile /></AppShell>,
});

function Profile() {
  const [email, setEmail] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const fetchDevices = useServerFn(listDevices);
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices({}),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and Smart Deck devices.</p>
      </div>

      <Card><CardContent className="p-5">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground">Email:</span> <span className="font-medium">{email || "—"}</span>
        </div>
      </CardContent></Card>

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
      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this device?")) mutation.mutate(); }}>
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
