import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Camera,
  Upload,
  Pencil,
  Save,
  ChevronDown,
  Loader2,
  ImageIcon,
  Scale,
  Flame,
  Gauge,
} from "lucide-react";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { saveMeal } from "@/lib/meals.functions";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [greeting, setGreeting] = useState("Hello");
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const saveMealFn = useServerFn(saveMeal);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
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

  return (
    <div className={`space-y-6 pb-8 ${meal ? "pb-40" : ""}`}>
      {/* Greeting + Calorie ring */}
      <header className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {greeting}
            {name ? `, ${name.split(" ")[0]}` : ""}
          </h1>
        </div>

        <div className="flex justify-center">
          <CalorieRing pct={ringPct} consumed={consumed} goal={DAILY_GOAL} />
        </div>
      </header>

      {/* Live meal preview */}
      <Card className="overflow-hidden rounded-[2rem] border-0 shadow-[0_12px_40px_-12px_rgba(16,80,40,0.18)]">
        <div
          className="grid w-full place-items-center bg-gradient-to-br from-secondary/70 via-muted/60 to-secondary/40"
          style={{ height: 320 }}
        >
          {meal ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-background/80 shadow-sm">
                <ImageIcon className="h-9 w-9" />
              </div>
              <p className="text-sm font-medium">Live meal preview</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-background/80 shadow-sm">
                <Camera className="h-9 w-9" />
              </div>
              <p className="text-sm font-medium">Capture or upload to begin</p>
            </div>
          )}
        </div>
      </Card>

      {/* Capture / Upload */}
      {!meal && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={processMock}
            className="h-20 flex-col gap-1.5 rounded-2xl text-base shadow-[0_8px_28px_-12px_rgba(40,130,75,0.5)]"
          >
            <Camera className="h-6 w-6" />
            <span className="font-medium">Capture Meal</span>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={processMock}
            className="h-20 flex-col gap-1.5 rounded-2xl text-base"
          >
            <Upload className="h-6 w-6" />
            <span className="font-medium">Upload Meal</span>
          </Button>
        </div>
      )}

      {/* Meal result */}
      {meal && (
        <div className="space-y-4">
          {/* Compact stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Scale}
              label="Weight"
              value={`${totalWeight}`}
              unit="g"
              tone="primary"
            />
            <StatCard
              icon={Flame}
              label="Calories"
              value={`${meal.total_calories}`}
              unit="kcal"
              tone="accent"
            />
            <StatCard
              icon={Gauge}
              label="Confidence"
              value={`${meal.confidence}`}
              unit="%"
              tone="sky"
            />
          </div>

          {/* Detected foods (collapsible) */}
          <Collapsible defaultOpen>
            <Card className="rounded-[2rem] border-0 shadow-[0_12px_40px_-16px_rgba(16,80,40,0.14)]">
              <CollapsibleTrigger className="group flex w-full items-center justify-between p-5">
                <div className="text-left">
                  <p className="text-base font-semibold">Detected foods</p>
                  <p className="text-xs text-muted-foreground">
                    {meal.foods.length} items detected
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-3 px-5 pb-5">
                  {meal.foods.map((f, i) => (
                    <FoodCard key={f.name} food={f} index={i} />
                  ))}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Macros */}
          <Card className="rounded-[2rem] border-0 shadow-[0_12px_40px_-16px_rgba(16,80,40,0.14)]">
            <CardContent className="space-y-5 p-5">
              <p className="text-base font-semibold">Macros</p>
              <Macro label="Protein" value={meal.protein} goal={80} color="protein" />
              <Macro label="Carbs" value={meal.carbs} goal={250} color="carbs" />
              <Macro label="Fats" value={meal.fats} goal={70} color="fats" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sticky bottom actions */}
      {meal && (
        <div className="fixed bottom-[4.5rem] left-4 right-4 z-20">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-background/90 p-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18)] backdrop-blur">
            <Button
              variant="outline"
              size="lg"
              className="h-14 rounded-xl border-2 text-base"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-14 rounded-xl text-base shadow-[0_8px_24px_-10px_rgba(40,120,70,0.45)]"
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
  const size = 220;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const gradientId = "calorieRingGradient";

  return (
    <div
      className="relative rounded-full shadow-[0_16px_40px_-16px_rgba(40,130,75,0.35)]"
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
        <p className="text-4xl font-semibold tracking-tight">{consumed}</p>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
  value: string;
  unit: string;
  tone: "primary" | "accent" | "sky";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    sky: "bg-chart-4/10 text-chart-4",
  };

  return (
    <Card className="rounded-2xl border-0 shadow-[0_8px_24px_-12px_rgba(16,80,40,0.12)]">
      <CardContent className="flex flex-col items-center gap-2 p-4">
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tracking-tight">
            {value}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
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
    <div className="flex items-center gap-4 rounded-2xl bg-secondary/50 p-3">
      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${tone}`}>
        <span className="text-lg font-semibold">{food.name.charAt(0)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{food.name}</p>
        <p className="text-xs text-muted-foreground">{food.weight} g</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{food.calories}</p>
        <p className="text-xs text-muted-foreground">kcal</p>
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
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted-foreground">
          <span className={`font-semibold ${textMap[color]}`}>{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
