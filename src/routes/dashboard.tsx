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
    <div className="space-y-8 pb-4">
      {/* Greeting + Calorie ring */}
      <header className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
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
      <Card className="overflow-hidden rounded-3xl border-0 shadow-[0_8px_30px_-12px_rgba(16,80,40,0.15)]">
        <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-secondary/60 to-muted">
          {meal ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm">Live meal preview</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-background/70 shadow-sm">
                <Camera className="h-7 w-7" />
              </div>
              <p className="text-sm">Capture or upload to begin</p>
            </div>
          )}
        </div>
      </Card>

      {/* Capture / Upload */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          onClick={processMock}
          className="h-20 flex-col gap-1.5 rounded-2xl text-base shadow-[0_8px_24px_-10px_rgba(40,120,70,0.45)]"
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

      {/* Meal result */}
      {meal && (
        <div className="space-y-5">
          {/* Summary */}
          <Card className="rounded-3xl border-0 shadow-[0_8px_30px_-15px_rgba(16,80,40,0.18)]">
            <CardContent className="grid grid-cols-3 gap-2 p-6">
              <Summary label="Weight" value={`${totalWeight}`} unit="g" />
              <Summary label="Calories" value={`${meal.total_calories}`} unit="kcal" />
              <Summary label="Confidence" value={`${meal.confidence}`} unit="%" />
            </CardContent>
          </Card>

          {/* Detected foods (collapsible) */}
          <Collapsible defaultOpen>
            <Card className="rounded-3xl border-0 shadow-[0_8px_30px_-15px_rgba(16,80,40,0.12)]">
              <CollapsibleTrigger className="group flex w-full items-center justify-between p-5">
                <div className="text-left">
                  <p className="text-base font-medium">Detected foods</p>
                  <p className="text-xs text-muted-foreground">
                    {meal.foods.length} items
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-1 px-5 pb-5">
                  {meal.foods.map((f) => (
                    <li
                      key={f.name}
                      className="flex items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.weight} g</p>
                      </div>
                      <span className="text-sm font-semibold">{f.calories} kcal</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Macros */}
          <Card className="rounded-3xl border-0 shadow-[0_8px_30px_-15px_rgba(16,80,40,0.12)]">
            <CardContent className="space-y-5 p-6">
              <p className="text-base font-medium">Macros</p>
              <Macro label="Protein" value={meal.protein} goal={80} />
              <Macro label="Carbs" value={meal.carbs} goal={250} />
              <Macro label="Fats" value={meal.fats} goal={70} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              variant="outline"
              size="lg"
              className="h-14 rounded-2xl border-2 text-base"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-14 rounded-2xl text-base shadow-[0_8px_24px_-10px_rgba(40,120,70,0.45)]"
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
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
          stroke="var(--primary)"
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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          of {goal} kcal
        </p>
      </div>
    </div>
  );
}

function Summary({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold tracking-tight">
        {value}
        <span className="ml-0.5 text-sm font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Macro({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
