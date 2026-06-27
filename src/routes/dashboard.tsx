import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Upload, Scale, Utensils, Flame, Activity, Gauge, Pencil, Save, ChevronRight, Loader2 } from "lucide-react";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { saveMeal, listMeals } from "@/lib/meals.functions";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Dashboard — Smart Deck" }] }),
  component: () => <AppShell><Dashboard /></AppShell>,
});

// ---- Mock data ----
const MOCK_LIVE = {
  foods: [
    { name: "Rice", weight: 120, calories: 160 },
    { name: "Dal", weight: 80, calories: 110 },
    { name: "Roti", weight: 45, calories: 120 },
  ],
  total_calories: 390,
  protein: 14,
  carbs: 62,
  fats: 8,
  confidence: 92,
};

const MOCK_HISTORY_EMPTY: never[] = [];

function Dashboard() {
  const [meal] = useState(MOCK_LIVE);
  const totalWeight = meal.foods.reduce((s, f) => s + f.weight, 0);
  const queryClient = useQueryClient();
  const fetchMeals = useServerFn(listMeals);
  const saveMealFn = useServerFn(saveMeal);

  const { data: recent, isLoading: loadingRecent } = useQuery({
    queryKey: ["meals", "recent"],
    queryFn: () => fetchMeals({ data: { sinceDays: 30, limit: 5 } }),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveMealFn({ data: meal }),
    onSuccess: () => {
      toast.success("Meal saved");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save meal"),
  });



  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{format(new Date(), "EEEE, MMM d")}</p>
        <h1 className="text-2xl font-bold tracking-tight">Live Meal Capture</h1>
      </div>

      {/* Capture actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-20 flex-col gap-1.5">
          <Camera className="h-5 w-5" />
          <span className="text-sm font-semibold">Capture</span>
        </Button>
        <Button size="lg" variant="secondary" className="h-20 flex-col gap-1.5">
          <Upload className="h-5 w-5" />
          <span className="text-sm font-semibold">Upload Image</span>
        </Button>
      </div>

      {/* Preview placeholder */}
      <Card className="overflow-hidden">
        <div className="grid aspect-video place-items-center bg-secondary text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Camera className="h-8 w-8" />
            <p className="text-sm">Mock preview — capture to see image</p>
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Scale}
          label="Total Weight"
          value={`${totalWeight}`}
          unit="g"
          tint="bg-blue-500/10 text-blue-600"
        />
        <StatCard
          icon={Flame}
          label="Calories"
          value={`${meal.total_calories}`}
          unit="kcal"
          tint="bg-orange-500/10 text-orange-600"
        />
        <StatCard
          icon={Utensils}
          label="Detected Foods"
          value={`${meal.foods.length}`}
          unit="items"
          tint="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          icon={Gauge}
          label="Confidence"
          value={`${meal.confidence}`}
          unit="%"
          tint="bg-violet-500/10 text-violet-600"
        />
      </div>

      {/* Food detection */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Food Detection</h2>
            <Badge variant="secondary" className="gap-1">
              <Activity className="h-3 w-3" /> Mock
            </Badge>
          </div>
          <ul className="divide-y">
            {meal.foods.map((f) => (
              <li key={f.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.weight} g</p>
                </div>
                <span className="text-sm font-semibold">{f.calories} kcal</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Macros */}
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-base font-semibold">Macros</h2>
          <div className="grid grid-cols-3 gap-3">
            <Macro label="Protein" value={meal.protein} color="bg-rose-500" />
            <Macro label="Carbs" value={meal.carbs} color="bg-amber-500" />
            <Macro label="Fats" value={meal.fats} color="bg-sky-500" />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" className="h-12">
          <Pencil className="mr-2 h-4 w-4" /> Correct
        </Button>
        <Button size="lg" className="h-12">
          <Save className="mr-2 h-4 w-4" /> Save Meal
        </Button>
      </div>

      {/* History */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Meal History</h2>
          <Link to="/history" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {MOCK_HISTORY.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <Utensils className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.time} · {m.weight} g · {m.confidence}%</p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{m.calories} kcal</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, tint }: { icon: any; label: string; value: string; unit: string; tint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`mb-2 inline-grid h-8 w-8 place-items-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold">
          {value}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, value * 2);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}g</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
