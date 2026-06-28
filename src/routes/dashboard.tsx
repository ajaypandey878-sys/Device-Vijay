import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  Pencil,
  Save,
  Loader2,
  ImageIcon,
  Scale,
  Flame,
  Gauge,
} from "lucide-react";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { saveMeal } from "@/lib/meals.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Dashboard — Smart Deck" }] }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

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

const DAILY_GOAL = 2000;

function Dashboard() {
  const [meal, setMeal] = useState<typeof MOCK_LIVE | null>(null);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const saveMealFn = useServerFn(saveMeal);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const n =
        (data.user?.user_metadata?.full_name as string) ??
        (data.user?.user_metadata?.name as string) ??
        data.user?.email?.split("@")[0] ??
        "";
      setName(n);
    });
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => saveMealFn({ data: meal! }),
    onSuccess: () => {
      toast.success("Meal saved");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setMeal(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save meal"),
  });

  const processMock = () => setMeal(MOCK_LIVE);

  const totalWeight = meal?.foods.reduce((s, f) => s + f.weight, 0) ?? 0;
  const consumed = meal?.total_calories ?? 0;
  const ringPct = Math.min(100, (consumed / DAILY_GOAL) * 100);
  const confidence = meal?.confidence ?? 0;

  return (
    <div className="space-y-1.5">
      {/* Top row: 3 compact stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={Scale}
          label="Weight"
          value={totalWeight}
          unit="g"
          tone="primary"
        />
        <StatCard
          icon={Flame}
          label="Calories"
          value={consumed}
          unit="kcal"
          tone="accent"
        />
        <StatCard
          icon={Gauge}
          label="Confidence"
          value={confidence}
          unit="%"
          tone="sky"
        />
      </div>

      {/* Live meal preview card */}
      <Card className="overflow-hidden rounded-[1.75rem] border-0 shadow-[0_12px_40px_-12px_rgba(16,80,40,0.16)]">
        <div
          className="grid w-full place-items-center bg-gradient-to-br from-secondary/70 via-muted/50 to-secondary/30"
          style={{ height: 280 }}
        >
          {meal ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-sm">
                <ImageIcon className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">Live meal preview</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-sm">
                <Camera className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">Capture or upload to begin</p>
            </div>
          )}
        </div>
      </Card>

      {/* Capture / Upload buttons */}
      {!meal && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={processMock}
            className="h-16 flex-col gap-1 rounded-2xl text-sm shadow-[0_8px_28px_-12px_rgba(40,130,75,0.45)]"
          >
            <Camera className="h-5 w-5" />
            <span className="font-semibold">Capture Meal</span>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={processMock}
            className="h-16 flex-col gap-1 rounded-2xl text-sm"
          >
            <Upload className="h-5 w-5" />
            <span className="font-semibold">Upload Meal</span>
          </Button>
        </div>
      )}

      {/* Active meal results */}
      {meal && (
        <div className="space-y-1.5">
          {/* Calorie ring below preview */}
          <div className="flex justify-center">
            <CalorieRing
              pct={ringPct}
              consumed={consumed}
              goal={DAILY_GOAL}
            />
          </div>

          {/* Detected food cards */}
          <div className="grid grid-cols-3 gap-1.5">
            {meal.foods.map((food, i) => (
              <FoodCard key={food.name} food={food} index={i} />
            ))}
          </div>

          {/* Compact macro bars */}
          <Card className="rounded-[1.75rem] border-0 shadow-[0_8px_30px_-12px_rgba(16,80,40,0.12)]">
            <CardContent className="space-y-1 p-2">
              <Macro label="Protein" value={meal.protein} goal={80} color="protein" />
              <Macro label="Carbs" value={meal.carbs} goal={250} color="carbs" />
              <Macro label="Fats" value={meal.fats} goal={70} color="fats" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky bottom actions */}
      {meal && (
        <div className="fixed bottom-14 left-3 right-3 z-20">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/50 bg-background/95 p-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl border-2 border-primary/30 bg-background text-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-12 rounded-xl text-sm font-semibold shadow-[0_8px_24px_-10px_rgba(40,120,70,0.4)]"
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Meal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalorieRing({
  pct,
  consumed,
  goal,
}: {
  pct: number;
  consumed: number;
  goal: number;
}) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const gradientId = "calorieRingGradient";

  return (
    <div
      className="relative rounded-full shadow-[0_12px_30px_-12px_rgba(40,130,75,0.35)]"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--secondary)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xl font-semibold tracking-tight">{consumed}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          of {goal} kcal
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "accent" | "sky";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    sky: "bg-chart-4/10 text-chart-4",
  };

  return (
    <Card className="h-16 rounded-2xl border-0 shadow-[0_6px_18px_-8px_rgba(16,80,40,0.12)]">
      <CardContent className="flex h-full flex-col items-center justify-center gap-1 p-2">
        <div className={`grid h-6 w-6 place-items-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold leading-none">
            {value}
            <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{unit}</span>
          </p>
          <p className="text-[10px] font-medium leading-none text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const FOOD_THUMBNAILS = [
  "bg-chart-1/10 text-chart-1",
  "bg-chart-2/10 text-chart-2",
  "bg-chart-3/10 text-chart-3",
  "bg-chart-4/10 text-chart-4",
  "bg-chart-5/10 text-chart-5",
];

function FoodCard({
  food,
  index,
}: {
  food: { name: string; weight: number; calories: number };
  index: number;
}) {
  const tone = FOOD_THUMBNAILS[index % FOOD_THUMBNAILS.length];
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-secondary/50 p-2 text-center shadow-sm">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone}`}>
        <span className="text-sm font-semibold">{food.name.charAt(0)}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-none">{food.name}</p>
        <p className="text-[10px] text-muted-foreground">{food.weight} g · {food.calories} kcal</p>
      </div>
    </div>
  );
}

function Macro({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: "protein" | "carbs" | "fats";
}) {
  const pct = Math.min(100, (value / goal) * 100);
  const colorMap = {
    protein: "bg-macro-protein",
    carbs: "bg-macro-carbs",
    fats: "bg-macro-fats",
  };
  const textMap = {
    protein: "text-macro-protein",
    carbs: "text-macro-carbs",
    fats: "text-macro-fats",
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between leading-none">
        <span className="text-[10px] font-semibold">{label}</span>
        <span className="text-[10px] text-muted-foreground">
          <span className={`font-semibold ${textMap[color]}`}>{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
