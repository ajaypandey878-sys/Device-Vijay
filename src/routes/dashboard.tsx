import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  head: () => ({ meta: [{ title: "Dashboard — AshoMa" }] }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

const MOCK_LIVE = {
  image_url:
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=1200&q=80&auto=format&fit=crop",
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [, setName] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
      setCapturedImage(null);
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? "Failed to save meal"),
  });

  const processMock = () => setMeal(MOCK_LIVE);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCapturedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const previewSrc = meal?.image_url ?? capturedImage;

  const totalWeight = meal?.foods.reduce((s, f) => s + f.weight, 0) ?? 0;
  const consumed = meal?.total_calories ?? 0;
  const ringPct = Math.min(100, (consumed / DAILY_GOAL) * 100);
  const confidence = meal?.confidence ?? 0;

  return (
    <div className={meal ? "space-y-5 pb-36" : "space-y-5"}>
      {/* Edge-to-edge meal preview */}
      <div className="-mx-4 md:-mx-6" data-testid="meal-preview">
        <div className="overflow-hidden rounded-[20px] md:mx-0">
          <div
            className="relative w-full bg-gradient-to-br from-secondary/70 via-muted/50 to-secondary/30"
            style={{ height: 220 }}
          >
            {previewSrc ? (
              <>
                <img
                  src={previewSrc}
                  alt="Captured meal"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary shadow-sm backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {meal ? "Live" : "Captured"}
                </span>
                {capturedImage && !meal && (
                  <button
                    type="button"
                    onClick={() => setCapturedImage(null)}
                    className="absolute right-3 top-3 rounded-full bg-background/85 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur"
                  >
                    Retake
                  </button>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-sm">
                  <Camera className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium">Capture or upload to begin</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphic stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Scale} label="Weight" value={totalWeight} unit="g" tone="primary" />
        <StatCard icon={Flame} label="Calories" value={consumed} unit="kcal" tone="accent" />
        <StatCard icon={Gauge} label="Confidence" value={confidence} unit="%" tone="sky" />
      </div>

      {/* Capture / Upload buttons */}
      {!meal && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={processMock}
            className="h-16 flex-col gap-1 rounded-2xl text-sm shadow-[0_12px_32px_-12px_rgba(40,130,75,0.55)]"
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

      {meal && (
        <>
          {/* Glowing calorie ring */}
          <div className="flex flex-col items-center justify-center gap-2" data-testid="calorie-ring">
            <CalorieRing pct={ringPct} consumed={consumed} goal={DAILY_GOAL} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Daily intake
            </p>
          </div>

          {/* Detected food cards */}
          <section className="space-y-2.5" data-testid="detected-foods">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Detected foods
              </p>
              <span className="text-[11px] text-muted-foreground">
                {meal.foods.length} items
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {meal.foods.map((food, i) => (
                <FoodCard key={food.name} food={food} index={i} />
              ))}
            </div>
          </section>

          {/* Smooth macro bars */}
          <section className="space-y-3" data-testid="macro-bars">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Macros
            </p>
            <Card className="rounded-3xl border-0 shadow-[0_10px_36px_-18px_rgba(16,80,40,0.25)]">
              <CardContent className="space-y-3.5 p-4">
                <Macro label="Protein" value={meal.protein} goal={80} color="protein" icon={Dumbbell} />
                <Macro label="Carbs" value={meal.carbs} goal={250} color="carbs" icon={Wheat} />
                <Macro label="Fats" value={meal.fats} goal={70} color="fats" icon={Droplets} />
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* Floating glassy action bar */}
      {meal && (
        <div className="fixed bottom-16 left-4 right-4 z-20 md:left-1/2 md:max-w-3xl md:-translate-x-1/2 md:px-6" data-testid="action-bar">
          <div className="grid grid-cols-2 gap-2.5 rounded-3xl border border-white/40 bg-background/60 p-2 shadow-[0_20px_50px_-20px_rgba(16,80,40,0.45)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-2xl border-primary/25 bg-background/80 text-foreground hover:bg-background"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-12 rounded-2xl text-sm font-semibold shadow-[0_14px_32px_-14px_rgba(40,130,75,0.7)]"
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
  const size = 168;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const gradientId = "calorieRingGradient";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* glow */}
      <div
        className="absolute inset-2 rounded-full blur-2xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 55%, transparent) 0%, transparent 70%)",
        }}
      />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--success, var(--primary))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="color-mix(in oklab, var(--primary) 10%, var(--secondary))"
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
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{consumed}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    sky: "bg-chart-4/15 text-chart-4",
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/50 bg-background/60 p-3 shadow-[0_10px_28px_-16px_rgba(16,80,40,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55"
    >
      <div className="flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xl font-semibold leading-none tabular-nums">
        {value}
        <span className="ml-1 text-[11px] font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

const FOOD_TONES = [
  { wrap: "bg-[color-mix(in_oklab,var(--chart-1)_14%,white)]", icon: "bg-chart-1/20 text-chart-1" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-2)_14%,white)]", icon: "bg-chart-2/20 text-chart-2" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-3)_14%,white)]", icon: "bg-chart-3/20 text-chart-3" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-4)_14%,white)]", icon: "bg-chart-4/20 text-chart-4" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-5)_14%,white)]", icon: "bg-chart-5/20 text-chart-5" },
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
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl ${tone.wrap} p-3 text-center shadow-[0_10px_24px_-14px_rgba(16,80,40,0.25)]`}
      data-testid="food-card"
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone.icon} shadow-sm`}>
        <UtensilsCrossed className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{food.name}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {food.weight}g · {food.calories} kcal
        </p>
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
  const fromMap = {
    protein: "from-macro-protein/80 to-macro-protein",
    carbs: "from-macro-carbs/80 to-macro-carbs",
    fats: "from-macro-fats/80 to-macro-fats",
  };
  const textMap = {
    protein: "text-macro-protein",
    carbs: "text-macro-carbs",
    fats: "text-macro-fats",
  };
  const bgTone = {
    protein: "bg-macro-protein/15",
    carbs: "bg-macro-carbs/15",
    fats: "bg-macro-fats/15",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`grid h-6 w-6 place-items-center rounded-lg ${bgTone[color]} ${textMap[color]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          <span className={`font-semibold ${textMap[color]}`}>{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary/70">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fromMap[color]} transition-[width] duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
