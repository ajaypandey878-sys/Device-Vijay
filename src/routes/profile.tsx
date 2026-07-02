import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDevices, createDevice, deleteDevice } from "@/lib/devices.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, Plus, Trash2, KeyRound, Target, Activity, Cpu, Bell, Shield, Download, HelpCircle, MessageSquare, LogOut, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { clearProfile, goalMeta, useProfile, useTargets } from "@/lib/user-profile";
import { SettingsPanel, type PanelKey } from "@/components/settings-panel";

export const Route = createFileRoute("/profile")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Profile — AshoMa" }] }),
  component: () => <AppShell><Profile /></AppShell>,
});

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const profile = useProfile();
  const targets = useTargets();
  const [panel, setPanel] = useState<PanelKey | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const fetchDevices = useServerFn(listDevices);
  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices({}),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const meta = profile ? goalMeta(profile.goal) : null;

  return (
    <div className="space-y-4 pb-4">
      {/* Identity */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 via-white/[0.02] to-transparent p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/20 text-lg font-black text-primary">
            {(email[0] ?? "A").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{email || "—"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {meta ? `${meta.emoji} ${meta.label}` : "No goal set"}
            </p>
          </div>
          <Link to="/onboarding" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Edit
          </Link>
        </div>
      </div>

      {/* Targets */}
      <Section title="Your Targets" icon={<Target className="h-4 w-4 text-primary" />}>
        <div className="grid grid-cols-2 gap-2">
          <TargetTile label="Daily Calories" value={`${targets.kcal}`} suffix="kcal" />
          <TargetTile label="Protein" value={`${targets.proteinG}`} suffix="g" />
          <TargetTile label="Carbs" value={`${targets.carbsG}`} suffix="g" />
          <TargetTile label="Fats" value={`${targets.fatsG}`} suffix="g" />
        </div>
      </Section>

      {/* Profile facts */}
      {profile && (
        <Section title="About You" icon={<Activity className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Fact label="Age" value={`${profile.age}`} />
            <Fact label="Weight" value={`${profile.weightKg} kg`} />
            <Fact label="Height" value={`${profile.heightCm} cm`} />
            <Fact label="Gender" value={profile.gender} />
            <Fact label="Activity" value={profile.activity} />
            <Fact label="Goal" value={goalMeta(profile.goal).label} />
          </div>
        </Section>
      )}

      {/* Devices */}
      <Section title="Devices" icon={<Cpu className="h-4 w-4 text-primary" />} action={<NewDeviceDialog />}>
        <div className="space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!isLoading && (devices ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No devices yet. Add your first one to get a token.</p>
          )}
          {(devices ?? []).map((d) => <DeviceRow key={d.id} device={d} />)}
        </div>
      </Section>

      {/* Preferences */}
      <Section title="Preferences" icon={<Bell className="h-4 w-4 text-primary" />}>
        <div className="divide-y divide-white/[0.06]">
          <SettingRow label="Meal preferences" hint="Cuisines and defaults" onClick={() => setPanel("meal_prefs")} />
          <SettingRow label="Allergies" hint="Foods to warn about" onClick={() => setPanel("allergies")} />
          <SettingRow label="Dietary restrictions" hint="Vegetarian, vegan, etc." onClick={() => setPanel("restrictions")} />
          <SettingRow label="Notifications" hint="Meal reminders" onClick={() => setPanel("notifications")} />
        </div>
      </Section>

      <Section title="Data & Privacy" icon={<Shield className="h-4 w-4 text-primary" />}>
        <div className="divide-y divide-white/[0.06]">
          <SettingRow label="Data export" icon={<Download className="h-3.5 w-3.5" />} onClick={() => setPanel("export")} />
          <SettingRow label="Privacy settings" icon={<Shield className="h-3.5 w-3.5" />} onClick={() => setPanel("privacy")} />
          <SettingRow label="Subscription" hint="Free plan" onClick={() => setPanel("subscription")} />
        </div>
      </Section>

      <Section title="Support" icon={<HelpCircle className="h-4 w-4 text-primary" />}>
        <div className="divide-y divide-white/[0.06]">
          <SettingRow label="Help center" icon={<HelpCircle className="h-3.5 w-3.5" />} onClick={() => setPanel("help")} />
          <SettingRow label="Contact support" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => setPanel("support")} />
          <SettingRow label="Feedback" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => setPanel("feedback")} />
        </div>
      </Section>

      <button
        onClick={() => { clearProfile(); signOut(); }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/15"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>

      <SettingsPanel panel={panel} onClose={() => setPanel(null)} />
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function TargetTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">
        {value}<span className="ml-1 text-xs font-medium text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold capitalize">{value}</p>
    </div>
  );
}

function SettingRow({ label, hint, icon, onClick }: { label: string; hint?: string; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:opacity-80">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
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
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{device.name}</p>
        <p className="text-[10px] text-muted-foreground">
          <code>{device.token_prefix}…</code>
          {device.last_seen_at ? ` · ${formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}` : " · never connected"}
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
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{token ? "Save your device token" : "Add an AshoMa"}</DialogTitle>
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
