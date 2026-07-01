import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals } from "@/lib/meals.functions";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { goalMeta, useProfile, useTargets } from "@/lib/user-profile";
import { Flame, TrendingUp, PieChart, Calendar, Sparkles } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/insights")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Insights — AshoMa" }] }),
  component: () => <AppShell><Insights /></AppShell>,
});

type Meal = {
  captured_at: string;
  calories: number | null;
  nutrients: { protein_g?: number; carbs_g?: number; fat_g?: number } | null;
};

function Insights() {
  const fetchMeals = useServerFn(listMeals);
  const { data } = useQuery({
    queryKey: ["meals", "insights"],
    queryFn: () => fetchMeals({ data: { sinceDays: 30, limit: 300 } }),
  });
  const meals = (data ?? []) as unknown as Meal[];
  const profile = useProfile();
  const targets = useTargets();

  const today = useMemo(() => new Date().toDateString(), []);
  const todays = meals.filter((m) => new Date(m.captured_at).toDateString() === today);
  const consumed = Math.round(todays.reduce((s, m) => s + Number(m.calories ?? 0), 0));
  const remaining = Math.max(0, targets.kcal - consumed);

  // Meal timing buckets
  const buckets = { Breakfast: 0, Lunch: 0, Dinner: 0, Snacks: 0 };
  for (const m of todays) {
    const h = new Date(m.captured_at).getHours();
    const k = h < 11 ? "Breakfast" : h < 15 ? "Lunch" : h < 21 ? "Dinner" : "Snacks";
    buckets[k as keyof typeof buckets] += Number(m.calories ?? 0);
  }

  // Macro split (last 7 days)
  const weekMs = 7 * 86400000;
  const since = Date.now() - weekMs;
  const week = meals.filter((m) => +new Date(m.captured_at) >= since);
  const macros = week.reduce(
    (a, m) => {
      a.p += Number(m.nutrients?.protein_g ?? 0);
      a.c += Number(m.nutrients?.carbs_g ?? 0);
      a.f += Number(m.nutrients?.fat_g ?? 0);
      return a;
    },
    { p: 0, c: 0, f: 0 },
  );
  const macroTotal = macros.p * 4 + macros.c * 4 + macros.f * 9 || 1;
  const macroPct = {
    p: Math.round(((macros.p * 4) / macroTotal) * 100),
    c: Math.round(((macros.c * 4) / macroTotal) * 100),
    f: Math.round(((macros.f * 9) / macroTotal) * 100),
  };

  // 7-day trend
  const days: { label: string; kcal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toDateString();
    const sum = meals.filter((m) => new Date(m.captured_at).toDateString() === key)
      .reduce((s, m) => s + Number(m.calories ?? 0), 0);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" })[0], kcal: Math.round(sum) });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.kcal), targets.kcal);

  const goalInsights = getGoalInsights(profile?.goal, { targets, days, macros });

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          {profile ? `Personalized for ${goalMeta(profile.goal).label}` : "Your nutrition trends"}
        </p>
      </div>

      {/* Calorie budget gauge */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Calorie Budget · Today</p>
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <Stat label="Consumed" value={consumed} tone="fg" />
          <Stat label="Target" value={targets.kcal} tone="muted" />
          <Stat label="Remaining" value={remaining} tone="primary" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-primary transition-all" style={{ width: `${Math.min(100, (consumed / targets.kcal) * 100)}%` }} />
        </div>
      </div>

      {/* Meal timing */}
      <Card icon={<Calendar className="h-4 w-4 text-primary" />} title="Meal Timing · Today">
        <div className="space-y-2.5">
          {Object.entries(buckets).map(([k, v]) => (
            <Row key={k} label={k} right={`${Math.round(v)} kcal`} pct={Math.min(100, (v / targets.kcal) * 100)} />
          ))}
        </div>
      </Card>

      {/* Macro split */}
      <Card icon={<PieChart className="h-4 w-4 text-primary" />} title="Macro Split · Last 7 days">
        <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full bg-blue-500" style={{ width: `${macroPct.p}%` }} />
          <div className="h-full bg-yellow-500" style={{ width: `${macroPct.c}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${macroPct.f}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MacroPill dot="bg-blue-500" label="Protein" pct={macroPct.p} />
          <MacroPill dot="bg-yellow-500" label="Carbs" pct={macroPct.c} />
          <MacroPill dot="bg-rose-500" label="Fats" pct={macroPct.f} />
        </div>
      </Card>

      {/* Weekly trend */}
      <Card icon={<TrendingUp className="h-4 w-4 text-primary" />} title="Weekly Trend · 7 Days">
        <div className="flex h-28 items-end justify-between gap-1.5">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex h-full w-full items-end">
                <div className="w-full rounded-t-md bg-gradient-to-t from-primary to-success transition-all" style={{ height: `${(d.kcal / maxDay) * 100}%` }} />
              </div>
              <span className="text-[9px] font-semibold uppercase text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Goal-based insights */}
      <Card icon={<Sparkles className="h-4 w-4 text-primary" />} title={profile ? `${goalMeta(profile.goal).label} · Insights` : "Insights"}>
        <ul className="space-y-2">
          {goalInsights.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "fg" | "muted" | "primary" }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Row({ label, right, pct }: { label: string; right: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground tabular-nums">{right}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MacroPill({ dot, label, pct }: { dot: string; label: string; pct: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-2">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums">{pct}%</p>
    </div>
  );
}

function getGoalInsights(
  goal: string | undefined,
  x: { targets: { kcal: number; proteinG: number }; days: { kcal: number }[]; macros: { p: number; c: number; f: number } },
): string[] {
  const avg = x.days.reduce((s, d) => s + d.kcal, 0) / (x.days.length || 1);
  const overDays = x.days.filter((d) => d.kcal > x.targets.kcal).length;
  const avgProtein = x.macros.p / (x.days.length || 1);
  switch (goal) {
    case "lose":
      return [
        `Weekly average: ${Math.round(avg)} kcal (target ${x.targets.kcal}).`,
        `${overDays} high-calorie day${overDays === 1 ? "" : "s"} this week.`,
        avg < x.targets.kcal ? "You're maintaining a deficit — great work." : "Reduce ~200 kcal/day to reach a steady deficit.",
      ];
    case "gain":
      return [
        `Avg protein: ${Math.round(avgProtein)}g/day (target ${x.targets.proteinG}g).`,
        avg > x.targets.kcal ? "Calorie surplus is consistent." : "Add 200–300 kcal/day to hit surplus.",
        "Prioritize protein at every meal for lean mass.",
      ];
    case "maintain":
      return [
        `Weekly balance: ${Math.round(avg)} kcal vs target ${x.targets.kcal}.`,
        Math.abs(avg - x.targets.kcal) < 150 ? "Excellent consistency this week." : "Small drift — recalibrate portions slightly.",
      ];
    case "healthier":
      return [
        `Protein share: ${Math.round(((x.macros.p * 4) / ((x.macros.p * 4 + x.macros.c * 4 + x.macros.f * 9) || 1)) * 100)}%.`,
        "Aim for balanced macros: ~30% protein, 40% carbs, 30% fats.",
        "Add more whole foods and reduce processed items.",
      ];
    default:
      return ["Complete onboarding to see personalized insights.", `Weekly average: ${Math.round(avg)} kcal.`];
  }
}
