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
  UtensilsCrossed,
  Dumbbell,
  Wheat,
  Droplets,
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
      <Card className="overflow-hidden rounded-[1.75rem] border-0 shadow-[0_12px_40px_-12px_rgba(16,80,40,0.16)]" data-testid="meal-preview">
        <div
          className="relative grid w-full place-items-center bg-gradient-to-br from-secondary/70 via-muted/50 to-secondary/30"
          style={{ height: 240 }}
        >
          {meal ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-background/90 shadow-[0_8px_24px_-8px_rgba(16,80,40,0.18)]">
                <UtensilsCrossed className="h-9 w-9 text-primary" />
              </div>
              <p className="text-sm font-medium">Live meal preview</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Active
              </span>
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
        <div className="space-y-2">
          {/* Green calorie ring below preview */}
          <div className="flex flex-col items-center justify-center gap-1" data-testid="calorie-ring">
            <CalorieRing
              pct={ringPct}
              consumed={consumed}
              goal={DAILY_GOAL}
            />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Daily intake
            </p>
          </div>

          {/* Detected food cards */}
          <Card className="rounded-[1.75rem] border-0 shadow-[0_8px_30px_-12px_rgba(16,80,40,0.12)]" data-testid="detected-foods">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected foods
                </p>
                <span className="text-[10px] text-muted-foreground">{meal.foods.length} items</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {meal.foods.map((food, i) => (
                  <FoodCard key={food.name} food={food} index={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Colorful macro bars */}
          <Card className="rounded-[1.75rem] border-0 shadow-[0_8px_30px_-12px_rgba(16,80,40,0.12)]" data-testid="macro-bars">
            <CardContent className="space-y-2 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Macros
              </p>
              <Macro
                label="Protein"
                value={meal.protein}
                goal={80}
                color="protein"
                icon={Dumbbell}
              />
              <Macro
                label="Carbs"
                value={meal.carbs}
                goal={250}
                color="carbs"
                icon={Wheat}
              />
              <Macro
                label="Fats"
                value={meal.fats}
                goal={70}
                color="fats"
                icon={Droplets}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky bottom actions */}
      {meal && (
        <div className="fixed bottom-14 left-3 right-3 z-20" data-testid="action-bar">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/50 bg-background/95 p-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="h-13 rounded-xl border-2 border-primary/30 bg-background text-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-13 rounded-xl text-sm font-semibold shadow-[0_8px_24px_-10px_rgba(40,120,70,0.4)]"
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

const FOOD_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

function FoodCard({
  food,
  index,
}: {
  food: { name: string; weight: number; calories: number };
  index: number;
}) {
  const tone = FOOD_TONES[index % FOOD_TONES.length];
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary/50 p-2.5 text-center shadow-sm">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone}`}>
        <UtensilsCrossed className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight">{food.name}</p>
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
  icon: Icon,
}: {
  label: string;
  value: number;
  goal: number;
  color: "protein" | "carbs" | "fats";
  icon: React.ElementType;
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
  const bgTone = {
    protein: "bg-macro-protein/10",
    carbs: "bg-macro-carbs/10",
    fats: "bg-macro-fats/10",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between leading-none">
        <div className="flex items-center gap-1.5">
          <div className={`grid h-5 w-5 place-items-center rounded-md ${bgTone[color]} ${textMap[color]}`}>
            <Icon className="h-3 w-3" />
          </div>
          <span className="text-xs font-semibold">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          <span className={`font-semibold ${textMap[color]}`}>{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
