import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals, getMealImageUrl } from "@/lib/meals.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { Camera, Flame, Scale, Ruler } from "lucide-react";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Dashboard — Smart Deck" }] }),
  component: () => <AppShell><Dashboard /></AppShell>,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const fetchMeals = useServerFn(listMeals);
  const { data: meals, isLoading } = useQuery({
    queryKey: ["meals", "recent"],
    queryFn: () => fetchMeals({ data: { sinceDays: 1, limit: 20 } }),
  });

  useEffect(() => {
    const channel = supabase
      .channel("meals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["meals"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const today = useMemo(() => {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    return (meals ?? []).filter((m) => new Date(m.captured_at) >= t0);
  }, [meals]);

  const totals = useMemo(() => {
    const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    for (const m of today) {
      t.calories += Number(m.calories ?? 0);
      const n = (m.nutrients ?? {}) as Record<string, number>;
      t.protein_g += Number(n.protein_g ?? 0);
      t.carbs_g += Number(n.carbs_g ?? 0);
      t.fat_g += Number(n.fat_g ?? 0);
    }
    return t;
  }, [today]);

  const latest = meals?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Calories" value={Math.round(totals.calories)} unit="kcal" />
        <Stat label="Protein" value={Math.round(totals.protein_g)} unit="g" />
        <Stat label="Carbs" value={Math.round(totals.carbs_g)} unit="g" />
        <Stat label="Fat" value={Math.round(totals.fat_g)} unit="g" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Latest meal</h2>
        {isLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : latest ? (
          <LiveMealCard meal={latest} />
        ) : (
          <EmptyLatest />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Last 24 hours</h2>
          <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(meals ?? []).slice(1, 10).map((m) => (
            <MealMini key={m.id} meal={m} />
          ))}
          {meals && meals.length <= 1 && <p className="text-sm text-muted-foreground">Nothing else yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}<span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span></p>
    </CardContent></Card>
  );
}

function EmptyLatest() {
  return (
    <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
      <Camera className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">No meal yet</p>
      <p className="text-sm text-muted-foreground">Place a plate on your Smart Deck — it'll show up here in real time.</p>
    </CardContent></Card>
  );
}

export function MealImage({ path }: { path: string | null }) {
  const fetchUrl = useServerFn(getMealImageUrl);
  const { data } = useQuery({
    queryKey: ["meal-image", path],
    queryFn: () => fetchUrl({ data: { path: path! } }),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
  if (!path) {
    return (
      <div className="grid aspect-square place-items-center bg-secondary text-muted-foreground">
        <Camera className="h-6 w-6" />
      </div>
    );
  }
  return data ? (
    <img src={data} alt="Meal" className="aspect-square w-full object-cover" loading="lazy" />
  ) : (
    <Skeleton className="aspect-square w-full" />
  );
}

function LiveMealCard({ meal }: { meal: any }) {
  const label = meal.corrected_label ?? meal.top_label ?? "Analyzing…";
  const weight = meal.corrected_weight_grams ?? meal.total_weight_grams;
  return (
    <Link to="/meal/$id" params={{ id: meal.id }} className="block">
      <Card className="overflow-hidden transition hover:shadow-md">
        <div className="grid md:grid-cols-[280px_1fr]">
          <MealImage path={meal.image_path} />
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{formatDistanceToNow(new Date(meal.captured_at), { addSuffix: true })}</Badge>
              {meal.top_confidence != null && (
                <Badge variant="outline">{Math.round(meal.top_confidence * 100)}% sure</Badge>
              )}
            </div>
            <h3 className="mt-3 text-2xl font-semibold">{label}</h3>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Metric icon={Flame} label="Calories" value={meal.calories != null ? `${Math.round(meal.calories)} kcal` : "—"} />
              <Metric icon={Scale} label="Weight" value={weight != null ? `${Math.round(Number(weight))} g` : "—"} />
              <Metric icon={Ruler} label="Depth" value={meal.depth_mm != null ? `${Math.round(Number(meal.depth_mm))} mm` : "—"} />
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function MealMini({ meal }: { meal: any }) {
  const label = meal.corrected_label ?? meal.top_label ?? "Meal";
  return (
    <Link to="/meal/$id" params={{ id: meal.id }}>
      <Card className="overflow-hidden transition hover:shadow-md">
        <MealImage path={meal.image_path} />
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <p className="truncate font-medium">{label}</p>
            {meal.calories != null && <span className="text-sm text-muted-foreground">{Math.round(meal.calories)} kcal</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(meal.captured_at), "p")}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
