import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals } from "@/lib/meals.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isYesterday } from "date-fns";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { MealImage } from "@/components/meal-image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "History — AshoMa" }] }),
  component: () => <AppShell><History /></AppShell>,
});

type Filter = "today" | "week" | "month";

function History() {
  const [filter, setFilter] = useState<Filter>("week");
  const fetchMeals = useServerFn(listMeals);
  const days = filter === "today" ? 1 : filter === "week" ? 7 : 30;
  const { data: meals, isLoading } = useQuery({
    queryKey: ["meals", "history", days],
    queryFn: () => fetchMeals({ data: { sinceDays: days, limit: 300 } }),
  });

  const groups = useMemo(() => groupByDate(meals ?? []), [meals]);

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal History</h1>
        <p className="text-sm text-muted-foreground">Track everything you've captured.</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-xl">
        {(["today", "week", "month"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition",
              filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : groups.length > 0 ? (
        <div className="space-y-5">
          {groups.map(([label, rows]) => (
            <section key={label} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{rows.length} meal{rows.length === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-2">
                {rows.map((m) => <MealRow key={m.id} meal={m} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-muted-foreground backdrop-blur-xl">
          No meals captured in this range.
        </div>
      )}
    </div>
  );
}

function groupByDate(meals: { captured_at: string; id: string }[]): [string, any[]][] {
  const map = new Map<string, any[]>();
  for (const m of meals) {
    const d = new Date(m.captured_at);
    const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEEE, MMM d");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries());
}

function MealRow({ meal }: { meal: any }) {
  const label = meal.corrected_label ?? meal.top_label ?? "Unknown meal";
  const weight = meal.corrected_weight_grams ?? meal.total_weight_grams;
  const conf = meal.top_confidence != null ? Math.round(meal.top_confidence * 100) : null;
  const confTone = conf == null ? "muted" : conf >= 80 ? "ok" : conf >= 50 ? "warn" : "bad";
  return (
    <Link to="/meal/$id" params={{ id: meal.id }}>
      <div className="grid grid-cols-[80px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 backdrop-blur-xl transition hover:bg-white/[0.06]">
        <div className="overflow-hidden rounded-xl bg-black/40">
          <MealImage path={meal.image_path} />
        </div>
        <div className="min-w-0 self-center">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{label}</p>
            {conf != null && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  confTone === "ok" && "bg-primary/15 text-primary",
                  confTone === "warn" && "bg-yellow-500/15 text-yellow-400",
                  confTone === "bad" && "bg-destructive/15 text-destructive",
                )}
              >
                {conf}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{format(new Date(meal.captured_at), "p")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold">
            {weight != null && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-muted-foreground">
                {Math.round(Number(weight))} g
              </span>
            )}
            {meal.calories != null && (
              <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-orange-300">
                {Math.round(meal.calories)} kcal
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
