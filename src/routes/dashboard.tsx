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
  Wifi,
  WifiOff,
  Radio,
} from "lucide-react";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { saveMeal } from "@/lib/meals.functions";
import { estimateWeight } from "@/lib/estimate-weight.functions";
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

const WEIGHT_API_URL =
  (typeof window !== "undefined" && window.localStorage.getItem("ashoma.weight_api_url")) ||
  (import.meta.env.VITE_WEIGHT_API_URL as string | undefined) ||
  "";

const IMAGE_API_URL =
  (typeof window !== "undefined" && window.localStorage.getItem("ashoma.image_api_url")) ||
  (import.meta.env.VITE_IMAGE_API_URL as string | undefined) ||
  "";

function useLiveWeight() {
  const [weight, setWeight] = useState<number | null>(null);
  const [status, setStatus] = useState<"waiting" | "live" | "error">("waiting");

  useEffect(() => {
    if (!WEIGHT_API_URL) {
      setStatus("waiting");
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(WEIGHT_API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as { weight?: number; grams?: number; value?: number };
        const g = data.weight ?? data.grams ?? data.value;
        if (cancelled) return;
        if (typeof g === "number" && Number.isFinite(g)) {
          setWeight(Math.round(g));
          setStatus("live");
        } else {
          setStatus("error");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { weight, status };
}

// Weight stabilization: if the live weight stays within ±2g for 3 seconds,
// emit a "locked" weight. Used to auto-trigger Pi camera capture.
function useStableWeight(weight: number | null, toleranceG = 2, windowMs = 3000) {
  const [lockedWeight, setLockedWeight] = useState<number | null>(null);
  const samplesRef = useRef<{ value: number; t: number }[]>([]);

  useEffect(() => {
    if (weight == null || weight <= 0) {
      samplesRef.current = [];
      setLockedWeight(null);
      return;
    }
    const now = Date.now();
    const samples = samplesRef.current;
    samples.push({ value: weight, t: now });
    // keep only the trailing windowMs of samples
    while (samples.length && now - samples[0].t > windowMs) samples.shift();
    if (samples.length < 2 || now - samples[0].t < windowMs) return;
    const min = Math.min(...samples.map((s) => s.value));
    const max = Math.max(...samples.map((s) => s.value));
    if (max - min <= toleranceG * 2) {
      const avg = Math.round(samples.reduce((s, x) => s + x.value, 0) / samples.length);
      setLockedWeight((prev) => (prev === avg ? prev : avg));
    }
  }, [weight, toleranceG, windowMs]);

  const reset = () => {
    samplesRef.current = [];
    setLockedWeight(null);
  };

  return { lockedWeight, reset };
}

// Placeholder: ask the Pi to fire the camera once weight is locked.
// Hits the same-origin /api/public/device/capture stub; the Pi will replace
// this with its real capture pipeline.
async function triggerDeviceCapture(weight: number) {
  try {
    await fetch("/api/public/device/capture-trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight, requested_at: new Date().toISOString() }),
      cache: "no-store",
    });
  } catch {
    // best-effort placeholder; Pi pulls capture commands via its own channel
  }
}

function useDeviceImage(onNew: (url: string) => void) {
  const [status, setStatus] = useState<"waiting" | "live" | "error">("waiting");
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!IMAGE_API_URL) {
      setStatus("waiting");
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(IMAGE_API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as {
          image_url?: string;
          url?: string;
          id?: string | number;
          timestamp?: string | number;
        };
        const url = data.image_url ?? data.url;
        const id = String(data.id ?? data.timestamp ?? url ?? "");
        if (cancelled) return;
        setStatus("live");
        if (url && id && id !== lastIdRef.current) {
          lastIdRef.current = id;
          onNew(url);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status };
}

function Dashboard() {
  const [meal, setMeal] = useState<typeof MOCK_LIVE | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<"device" | "manual" | null>(null);
  const [estimatedWeight, setEstimatedWeight] = useState<number | null>(null);
  const [estimationFailed, setEstimationFailed] = useState(false);
  const [, setName] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const saveMealFn = useServerFn(saveMeal);
  const estimateWeightFn = useServerFn(estimateWeight);

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

  const estimateMutation = useMutation({
    mutationFn: (image: string) =>
      estimateWeightFn({ data: { image } }) as Promise<{ grams: number | null }>,
    onSuccess: (res) => {
      if (res.grams != null) {
        setEstimatedWeight(res.grams);
        setEstimationFailed(false);
      } else {
        setEstimatedWeight(null);
        setEstimationFailed(true);
      }
    },
    onError: () => {
      setEstimatedWeight(null);
      setEstimationFailed(true);
    },
  });

  const resetCapture = () => {
    setCapturedImage(null);
    setCaptureSource(null);
    setEstimatedWeight(null);
    setEstimationFailed(false);
    estimateMutation.reset();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (meal) {
        const httpUrl = meal.image_url?.startsWith("http") ? meal.image_url : null;
        return saveMealFn({ data: { ...meal, image_url: httpUrl } });
      }
      const resolvedWeight =
        captureSource === "device" && liveWeight != null
          ? liveWeight
          : (estimatedWeight ?? 0);
      const httpUrl =
        capturedImage && capturedImage.startsWith("http") ? capturedImage : null;
      return saveMealFn({
        data: {
          foods: [{ name: "Unknown meal", weight: resolvedWeight, calories: 0 }],
          total_calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          confidence: 0,
          image_url: httpUrl,
        },
      });
    },
    onSuccess: () => {
      toast.success("Meal saved");
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setMeal(null);
      resetCapture();
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? "Failed to save meal"),
  });

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedImage(reader.result);
        setCaptureSource("manual");
        setEstimatedWeight(null);
        setEstimationFailed(false);
        estimateMutation.mutate(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const previewSrc = meal?.image_url ?? capturedImage;

  const { weight: liveWeight, status: weightStatus } = useLiveWeight();
  const { status: imageStatus } = useDeviceImage((url) => {
    setCapturedImage(url);
    setCaptureSource("device");
    setEstimatedWeight(null);
    setEstimationFailed(false);
  });
  const deviceConnected = weightStatus === "live" || imageStatus === "live";
  const deviceError =
    !deviceConnected && (weightStatus === "error" || imageStatus === "error");
  const totalWeight = meal?.foods.reduce((s, f) => s + f.weight, 0) ?? 0;
  const weightDisplay: { value: number | string; unit: string } = (() => {
    if (totalWeight > 0) return { value: totalWeight, unit: "g" };
    if (captureSource === "device" && liveWeight != null)
      return { value: liveWeight, unit: "g" };
    if (captureSource === "manual") {
      if (estimateMutation.isPending) return { value: "Estimating…", unit: "" };
      if (estimatedWeight != null) return { value: estimatedWeight, unit: "g" };
      if (estimationFailed) return { value: "Unknown", unit: "" };
      return { value: "Estimating…", unit: "" };
    }
    if (weightStatus === "live" && liveWeight !== null)
      return { value: liveWeight, unit: "g" };
    if (weightStatus === "error") return { value: "Disconnected", unit: "" };
    return { value: "Waiting...", unit: "" };
  })();
  const consumed = meal?.total_calories ?? 0;
  const ringPct = Math.min(100, (consumed / DAILY_GOAL) * 100);
  const confidence = meal?.confidence ?? 0;
  const canSave = !!(meal || capturedImage);
  const showActionBar = canSave;

  const statusText = (() => {
    if (captureSource === "manual") {
      if (estimateMutation.isPending) return "Manual meal captured · estimating weight…";
      if (estimatedWeight != null)
        return `Manual meal captured · ~${estimatedWeight}g estimated`;
      if (estimationFailed) return "Manual meal captured · weight unknown";
      return "Manual meal captured";
    }
    if (captureSource === "device") return "Device meal received · exact weight";
    if (deviceConnected) return "Connected · listening for new meals";
    if (deviceError) return "Disconnected · check device connection";
    return "Waiting for Smart Device...";
  })();

  const sourceBadge =
    captureSource === "device"
      ? "Device"
      : captureSource === "manual"
        ? estimatedWeight != null
          ? "Estimated"
          : estimationFailed
            ? "Unknown"
            : "Manual"
        : null;

  // Weight stabilization → auto-trigger Pi capture once the weight is locked.
  const { lockedWeight, reset: resetLock } = useStableWeight(liveWeight);
  const lastTriggeredRef = useRef<number | null>(null);
  useEffect(() => {
    if (lockedWeight == null) return;
    if (capturedImage || meal) return; // already have a frame
    if (lastTriggeredRef.current === lockedWeight) return;
    lastTriggeredRef.current = lockedWeight;
    triggerDeviceCapture(lockedWeight);
  }, [lockedWeight, capturedImage, meal]);
  useEffect(() => {
    if (!capturedImage && !meal) {
      lastTriggeredRef.current = null;
      resetLock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedImage, meal]);

  // Phase machine for animated device status pill
  type Phase = "idle" | "connected" | "measuring" | "stabilizing" | "capturing" | "processing";
  const phase: Phase = (() => {
    if (saveMutation.isPending || estimateMutation.isPending) return "processing";
    if (captureSource === "device" || meal) return "capturing";
    if (lockedWeight != null) return "capturing";
    if (liveWeight != null && liveWeight > 0) return "stabilizing";
    if (weightStatus === "live") return "measuring";
    if (deviceConnected) return "connected";
    return "idle";
  })();

  const confTone: "danger" | "warn" | "ok" =
    confidence >= 80 ? "ok" : confidence >= 50 ? "warn" : "danger";

  return (
    <div className={showActionBar ? "space-y-5 pb-36" : "space-y-5"}>

      {/* Smart Device Status */}
      <div
        className="flex items-center gap-3 rounded-2xl border border-white/50 bg-background/60 p-3.5 shadow-[0_10px_28px_-16px_rgba(16,80,40,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55"
        data-testid="device-status"
      >
        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            deviceConnected
              ? "bg-primary/15 text-primary"
              : deviceError
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {deviceConnected ? (
            <Radio className="h-5 w-5" />
          ) : deviceError ? (
            <WifiOff className="h-5 w-5" />
          ) : (
            <Wifi className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Smart Device Status</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{statusText}</p>
        </div>
        <PhasePill phase={phase} />
      </div>

      {/* Hero: live weight */}
      <WeightHero
        display={weightDisplay}
        phase={phase}
        live={liveWeight}
        locked={lockedWeight}
      />

      {/* Edge-to-edge meal preview */}
      <div className="-mx-4 md:-mx-6" data-testid="meal-preview">
        <div className="overflow-hidden rounded-[20px] md:mx-0">
          <div
            className={`relative w-full bg-gradient-to-br from-secondary/70 via-muted/50 to-secondary/30 ${
              previewSrc ? "glow-border" : ""
            }`}
            style={{ height: 220 }}
          >
            {previewSrc ? (
              <>
                <img
                  src={previewSrc}
                  alt="Captured meal"
                  className="absolute inset-0 h-full w-full object-cover animate-fade-in"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary shadow-sm backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {meal ? "Live" : (sourceBadge ?? "Captured")}
                </span>
                {capturedImage && !meal && (
                  <button
                    type="button"
                    onClick={resetCapture}
                    className="absolute right-3 top-3 rounded-full bg-background/85 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur"
                  >
                    Retake
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="shimmer absolute inset-0 opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-sm">
                    <Camera className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium">
                    {phase === "stabilizing"
                      ? "Stabilizing weight…"
                      : phase === "capturing"
                        ? "Capturing frame…"
                        : "Capture or upload to begin"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Secondary stat cards (Weight is hero above) */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Flame} label="Calories" value={consumed} unit="kcal" tone="accent" />
        <StatCard
          icon={Gauge}
          label="Confidence"
          value={confidence}
          unit="%"
          tone={confTone === "ok" ? "primary" : confTone === "warn" ? "accent" : "danger"}
        />
      </div>

      {/* Persistent Daily Macros */}
      <section className="space-y-3" data-testid="daily-macros">
        <Card className="rounded-3xl border-0 shadow-[0_10px_36px_-18px_rgba(16,80,40,0.25)]">
          <CardContent className="space-y-3.5 p-4">
            <Macro label="Protein" value={meal?.protein ?? 0} goal={80} color="protein" icon={Dumbbell} />
            <Macro label="Carbs" value={meal?.carbs ?? 0} goal={250} color="carbs" icon={Wheat} />
            <Macro label="Fats" value={meal?.fats ?? 0} goal={70} color="fats" icon={Droplets} />
          </CardContent>
        </Card>
      </section>


      {/* Hidden inputs for manual fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />


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
      {showActionBar && (
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

      {/* Manual fallback */}
      {!capturedImage && !meal && (
        <section className="space-y-2 pt-2" data-testid="manual-fallback">
          <div className="flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-border" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Not using your device?
            </p>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              className="h-10 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Capture manually
            </Button>
            <Button
              variant="outline"
              onClick={() => uploadInputRef.current?.click()}
              className="h-10 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload image
            </Button>
          </div>
        </section>
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
  value: number | string;
  unit: string;
  tone: "primary" | "accent" | "sky" | "danger";
}) {
  const toneClasses = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    sky: "bg-chart-4/15 text-chart-4",
    danger: "bg-destructive/15 text-destructive",
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
