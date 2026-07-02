import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Mail, Phone, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { getSettings, updateSettings, submitSupportRequest, submitFeedback, exportMealHistory } from "@/lib/settings.functions";

export type PanelKey =
  | "meal_prefs" | "allergies" | "restrictions" | "notifications"
  | "export" | "privacy" | "subscription"
  | "help" | "support" | "feedback";

const TITLES: Record<PanelKey, string> = {
  meal_prefs: "Meal preferences",
  allergies: "Allergies",
  restrictions: "Dietary restrictions",
  notifications: "Notifications",
  export: "Data export",
  privacy: "Privacy settings",
  subscription: "Subscription",
  help: "Help center",
  support: "Contact support",
  feedback: "Feedback",
};

export function SettingsPanel({ panel, onClose }: { panel: PanelKey | null; onClose: () => void }) {
  return (
    <Dialog open={!!panel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {panel && (
          <>
            <DialogHeader><DialogTitle>{TITLES[panel]}</DialogTitle></DialogHeader>
            <Body panel={panel} onClose={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ panel, onClose }: { panel: PanelKey; onClose: () => void }) {
  switch (panel) {
    case "meal_prefs": return <MealPrefs onClose={onClose} />;
    case "allergies": return <Allergies onClose={onClose} />;
    case "restrictions": return <Restrictions onClose={onClose} />;
    case "notifications": return <Notifications onClose={onClose} />;
    case "export": return <ExportData onClose={onClose} />;
    case "privacy": return <Privacy onClose={onClose} />;
    case "subscription": return <Subscription onClose={onClose} />;
    case "help": return <Help />;
    case "support": return <Support onClose={onClose} />;
    case "feedback": return <Feedback onClose={onClose} />;
  }
}

function useSettings() {
  const fetchSettings = useServerFn(getSettings);
  return useQuery({ queryKey: ["user-settings"], queryFn: () => fetchSettings({}) });
}

function useSaveSection(section: "meal_prefs" | "allergies" | "restrictions" | "notifications" | "privacy") {
  const qc = useQueryClient();
  const save = useServerFn(updateSettings);
  return useMutation({
    mutationFn: (value: Record<string, unknown>) => save({ data: { section, value } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-settings"] }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });
}

function Actions({ onClose, onSave, saving, saveLabel = "Save" }: { onClose: () => void; onSave: () => void; saving?: boolean; saveLabel?: string }) {
  return (
    <DialogFooter className="mt-4">
      <Button variant="ghost" onClick={onClose}>Close</Button>
      <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : saveLabel}</Button>
    </DialogFooter>
  );
}

/* ---------- MEAL PREFERENCES ---------- */
const CUISINES = ["Indian", "Chinese", "Italian", "Mexican", "Japanese", "Mediterranean", "American", "Thai"];
function MealPrefs({ onClose }: { onClose: () => void }) {
  const { data } = useSettings();
  const saved = (data?.meal_prefs ?? {}) as any;
  const [diet, setDiet] = useState<"veg" | "nonveg" | "eggetarian">(saved.diet ?? "veg");
  const [cuisines, setCuisines] = useState<string[]>(saved.cuisines ?? []);
  const [protein, setProtein] = useState<string>(saved.protein ?? "balanced");
  useEffect(() => {
    if (!data) return;
    const s = (data.meal_prefs ?? {}) as any;
    setDiet(s.diet ?? "veg"); setCuisines(s.cuisines ?? []); setProtein(s.protein ?? "balanced");
  }, [data]);
  const save = useSaveSection("meal_prefs");
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Diet</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["veg", "eggetarian", "nonveg"] as const).map((v) => (
            <button key={v} onClick={() => setDiet(v)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${diet === v ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03]"}`}>
              {v === "nonveg" ? "Non-veg" : v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Preferred cuisines</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CUISINES.map((c) => {
            const on = cuisines.includes(c);
            return (
              <button key={c} onClick={() => setCuisines(on ? cuisines.filter((x) => x !== c) : [...cuisines, c])}
                className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03]"}`}>{c}</button>
            );
          })}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Protein preference</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["low", "balanced", "high"] as const).map((v) => (
            <button key={v} onClick={() => setProtein(v)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${protein === v ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03]"}`}>{v}</button>
          ))}
        </div>
      </div>
      <Actions onClose={onClose} saving={save.isPending} onSave={() => save.mutate({ diet, cuisines, protein })} />
    </div>
  );
}

/* ---------- ALLERGIES ---------- */
const ALLERGY_LIST = ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Gluten", "Soy", "Shellfish", "Fish", "Sesame"];
function Allergies({ onClose }: { onClose: () => void }) {
  const { data } = useSettings();
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState<string>("");
  useEffect(() => {
    const s = (data?.allergies ?? {}) as any;
    setSelected(s.list ?? []); setCustom(s.custom ?? "");
  }, [data]);
  const save = useSaveSection("allergies");
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Common allergies</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ALLERGY_LIST.map((a) => {
            const on = selected.includes(a);
            return (
              <label key={a} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <Checkbox checked={on} onCheckedChange={(v) => setSelected(v ? [...selected, a] : selected.filter((x) => x !== a))} />
                {a}
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Label htmlFor="custom-allergy" className="text-xs uppercase tracking-widest text-muted-foreground">Other (comma separated)</Label>
        <Input id="custom-allergy" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Mustard, Kiwi" className="mt-2" />
      </div>
      <Actions onClose={onClose} saving={save.isPending} onSave={() => save.mutate({ list: selected, custom })} />
    </div>
  );
}

/* ---------- RESTRICTIONS ---------- */
const RESTRICTIONS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "jain", label: "Jain" },
  { key: "glutenFree", label: "Gluten-free" },
  { key: "dairyFree", label: "Dairy-free" },
] as const;
function Restrictions({ onClose }: { onClose: () => void }) {
  const { data } = useSettings();
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => { setState((data?.restrictions ?? {}) as Record<string, boolean>); }, [data]);
  const save = useSaveSection("restrictions");
  return (
    <div className="space-y-2">
      {RESTRICTIONS.map((r) => (
        <div key={r.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <span className="text-sm">{r.label}</span>
          <Switch checked={!!state[r.key]} onCheckedChange={(v) => setState({ ...state, [r.key]: v })} />
        </div>
      ))}
      <Actions onClose={onClose} saving={save.isPending} onSave={() => save.mutate(state)} />
    </div>
  );
}

/* ---------- NOTIFICATIONS ---------- */
const NOTIFS = [
  { key: "mealReminders", label: "Meal reminders" },
  { key: "waterReminder", label: "Water reminder" },
  { key: "weeklyInsights", label: "Weekly insights" },
] as const;
function Notifications({ onClose }: { onClose: () => void }) {
  const { data } = useSettings();
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => { setState((data?.notifications ?? {}) as Record<string, boolean>); }, [data]);
  const save = useSaveSection("notifications");
  return (
    <div className="space-y-2">
      {NOTIFS.map((n) => (
        <div key={n.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <span className="text-sm">{n.label}</span>
          <Switch checked={!!state[n.key]} onCheckedChange={(v) => setState({ ...state, [n.key]: v })} />
        </div>
      ))}
      <Actions onClose={onClose} saving={save.isPending} onSave={() => save.mutate(state)} />
    </div>
  );
}

/* ---------- PRIVACY ---------- */
const PRIVACY = [
  { key: "analytics", label: "Allow analytics", hint: "Anonymous usage stats" },
  { key: "cloudImages", label: "Allow cloud image processing", hint: "Send images for AI recognition" },
  { key: "saveHistory", label: "Save meal history", hint: "Store meals for history & insights" },
] as const;
function Privacy({ onClose }: { onClose: () => void }) {
  const { data } = useSettings();
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const s = (data?.privacy ?? {}) as Record<string, boolean>;
    setState({ analytics: true, cloudImages: true, saveHistory: true, ...s });
  }, [data]);
  const save = useSaveSection("privacy");
  return (
    <div className="space-y-2">
      {PRIVACY.map((p) => (
        <div key={p.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <div><p className="text-sm">{p.label}</p><p className="text-[11px] text-muted-foreground">{p.hint}</p></div>
          <Switch checked={!!state[p.key]} onCheckedChange={(v) => setState({ ...state, [p.key]: v })} />
        </div>
      ))}
      <Actions onClose={onClose} saving={save.isPending} onSave={() => save.mutate(state)} />
    </div>
  );
}

/* ---------- EXPORT ---------- */
function ExportData({ onClose }: { onClose: () => void }) {
  const fetchExport = useServerFn(exportMealHistory);
  const [busy, setBusy] = useState<null | "json" | "csv">(null);

  async function download(kind: "json" | "csv") {
    setBusy(kind);
    try {
      const rows = await fetchExport({});
      const mapped = rows.map((r: any) => {
        const n = (r.nutrients ?? {}) as any;
        return {
          date: r.captured_at,
          image: r.image_path ?? "",
          food: r.top_label ?? "",
          weight_g: r.total_weight_grams ?? "",
          calories: r.calories ?? "",
          protein_g: n.protein_g ?? "",
          carbs_g: n.carbs_g ?? "",
          fats_g: n.fats_g ?? "",
        };
      });
      let blob: Blob;
      let name: string;
      if (kind === "json") {
        blob = new Blob([JSON.stringify(mapped, null, 2)], { type: "application/json" });
        name = `ashoma-meals-${Date.now()}.json`;
      } else {
        const headers = Object.keys(mapped[0] ?? { date: "", image: "", food: "", weight_g: "", calories: "", protein_g: "", carbs_g: "", fats_g: "" });
        const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.join(","), ...mapped.map((row: any) => headers.map((h) => esc(row[h])).join(","))].join("\n");
        blob = new Blob([csv], { type: "text/csv" });
        name = `ashoma-meals-${Date.now()}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${mapped.length} meals`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Download all your meal history including weight, calories, and macros.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => download("json")} disabled={!!busy}>
          <FileJson className="mr-2 h-4 w-4" /> {busy === "json" ? "Exporting…" : "JSON"}
        </Button>
        <Button variant="outline" onClick={() => download("csv")} disabled={!!busy}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> {busy === "csv" ? "Exporting…" : "CSV"}
        </Button>
      </div>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
    </div>
  );
}

/* ---------- SUBSCRIPTION ---------- */
function Subscription({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Current plan</p>
        <p className="mt-1 text-2xl font-black">Free</p>
        <p className="mt-1 text-xs text-muted-foreground">Basic AshoMa features</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Credits left</p>
          <p className="mt-1 text-lg font-bold">Unlimited</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Billing</p>
          <p className="mt-1 text-lg font-bold">—</p>
        </div>
      </div>
      <Button className="w-full" onClick={() => toast.info("Pro plan coming soon")}>Upgrade to Pro</Button>
      <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
    </div>
  );
}

/* ---------- HELP ---------- */
const HELP_ITEMS = [
  { q: "How does the AshoMa device work?", a: "It combines a camera, 4 load cells (HX711), and a ToF depth sensor. A Raspberry Pi streams weight, image, and depth to your account over Wi-Fi." },
  { q: "How does weight capture work?", a: "The four load cells measure grams continuously. When the reading stays within ±2g for 3 seconds, the weight locks and triggers a photo." },
  { q: "How does image capture work?", a: "The camera captures a top-down photo once weight stabilizes. You can also upload a photo manually — AshoMa estimates portion size from the image." },
  { q: "How is calorie estimation done?", a: "Detected foods are matched against our nutrition database and combined with the measured weight to compute calories, protein, carbs, and fats." },
  { q: "How do weekly insights work?", a: "The Insights tab aggregates your meals into calorie budget, macro split, meal timing, and 7-day trends against your goal." },
  { q: "Troubleshooting", a: "If the weight card is stuck on Waiting, check your Pi is powered and paired. If Disconnected, verify Wi-Fi and the device token." },
  { q: "Device connection issues", a: "Re-add the device from Profile › Devices to generate a fresh token, then paste it into your Pi config and restart the service." },
];
function Help() {
  return (
    <div className="max-h-[60vh] space-y-2 overflow-y-auto">
      {HELP_ITEMS.map((it, i) => (
        <details key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-sm font-semibold">{it.q}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ---------- SUPPORT ---------- */
function Support({ onClose }: { onClose: () => void }) {
  const submit = useServerFn(submitSupportRequest);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => submit({ data: { subject, message } }),
    onSuccess: () => { toast.success("Support request sent"); setSubject(""); setMessage(""); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <a href="mailto:support@ashoma.app" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          <Mail className="h-4 w-4 text-primary" /> support@ashoma.app
        </a>
        <a href="tel:+918118811072" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          <Phone className="h-4 w-4 text-primary" /> +91 81188 11072
        </a>
      </div>
      <div>
        <Label htmlFor="sub">Subject</Label>
        <Input id="sub" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2" />
      </div>
      <div>
        <Label htmlFor="msg">Issue description</Label>
        <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="mt-2" />
      </div>
      <Actions onClose={onClose} saving={mutation.isPending} onSave={() => mutation.mutate()} saveLabel="Submit" />
    </div>
  );
}

/* ---------- FEEDBACK ---------- */
function Feedback({ onClose }: { onClose: () => void }) {
  const submit = useServerFn(submitFeedback);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => submit({ data: { rating, message: message || undefined } }),
    onSuccess: () => { toast.success("Thanks for your feedback"); setRating(0); setMessage(""); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Your rating</Label>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="p-1">
              <Star className={`h-7 w-7 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="fb">Message (optional)</Label>
        <Textarea id="fb" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="mt-2" />
      </div>
      <Actions onClose={onClose} saving={mutation.isPending} onSave={() => rating ? mutation.mutate() : toast.error("Please select a rating")} saveLabel="Submit" />
    </div>
  );
}
