import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useProfile, useTargets } from "@/lib/user-profile";
import { InsightCard } from "@/components/insight-card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  Pencil,
  Save,
  Loader2,
  Scale,
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
  const navigate = useNavigate();
  useProfile();
  const targets = useTargets();
  useEffect(() => {
    // gate: send new users to onboarding
    if (typeof window !== "undefined" && !window.localStorage.getItem("ashoma.profile.v1")) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [navigate]);

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
  const dailyGoal = targets.kcal || DAILY_GOAL;
  const ringPct = Math.min(100, (consumed / dailyGoal) * 100);
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

  // Stability percentage derived from phase for the mini-status card
  const stabilityPct =
    phase === "capturing" || phase === "processing"
      ? 100
      : phase === "stabilizing"
        ? 65
        : phase === "measuring"
          ? 30
          : 0;

  return (
    <div className={showActionBar ? "space-y-4 pb-36" : "space-y-4 pb-4"}>
      {/* 2. DEVICE STATUS — compact horizontal */}
      <DeviceStatusBar
        connected={deviceConnected}
        error={deviceError}
        statusText={statusText}
        phase={phase}
      />

      {/* 3. CAMERA HERO — main focus */}
      <CameraHero
        previewSrc={previewSrc}
        sourceBadge={sourceBadge}
        meal={!!meal}
        phase={phase}
        onCapture={() => cameraInputRef.current?.click()}
        onUpload={() => uploadInputRef.current?.click()}
        onRetake={capturedImage && !meal ? resetCapture : null}
      />

      {/* 4. WEIGHT CARD — secondary */}
      <WeightCard display={weightDisplay} phase={phase} live={liveWeight} locked={lockedWeight} />

      {/* 5. INSIGHT ROW — confidence + calories rings */}
      <div className="grid grid-cols-2 gap-3">
        <ConfidenceCard value={confidence} />
        <CaloriesCard value={consumed} goal={dailyGoal} pct={ringPct} />
      </div>

      {/* Personalized insight based on goal */}
      <InsightCard consumed={consumed} protein={meal?.protein ?? 0} />

      {/* 6. MINI STATUS ROW */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Stability" value={`${stabilityPct}%`} accent="primary" />
        <MiniStat label="Last Capture" value={meal || capturedImage ? "Just now" : "—"} accent="muted" />
      </div>

      {/* 7. MACRO CARD */}
      <MacroPanel
        protein={meal?.protein ?? 0}
        carbs={meal?.carbs ?? 0}
        fats={meal?.fats ?? 0}
      />

      {/* 8. RECENT MEALS */}
      <RecentMeals />

      {/* Detected foods (only when meal active) */}
      {meal && (
        <section className="space-y-2.5" data-testid="detected-foods">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Detected foods
            </p>
            <span className="text-[10px] text-muted-foreground">{meal.foods.length} items</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {meal.foods.map((food, i) => (
              <FoodCard key={food.name} food={food} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Hidden inputs (manual fallback) */}
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

      {/* Floating action bar */}
      {showActionBar && (
        <div className="fixed bottom-24 left-4 right-4 z-20 mx-auto max-w-3xl" data-testid="action-bar">
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-white/10 bg-background/70 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Correct
            </Button>
            <Button
              size="lg"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-12 rounded-xl text-sm font-semibold shadow-[0_0_28px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
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

/* ------------- Sub-components ------------- */

function DeviceStatusBar({
  connected,
  error,
  statusText,
  phase,
}: {
  connected: boolean;
  error: boolean;
  statusText: string;
  phase: "idle" | "connected" | "measuring" | "stabilizing" | "capturing" | "processing";
}) {
  const steps: Array<{ key: typeof phase; label: string }> = [
    { key: "measuring", label: "Measure" },
    { key: "stabilizing", label: "Stabilize" },
    { key: "capturing", label: "Capture" },
    { key: "processing", label: "Process" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            connected
              ? "bg-primary/15 text-primary shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
              : error
                ? "bg-destructive/15 text-destructive"
                : "bg-white/[0.04] text-muted-foreground"
          }`}
        >
          {connected ? <Radio className="h-4 w-4" /> : error ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight">
            {connected ? "Connected" : error ? "Offline" : "Waiting"}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{statusText}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {steps.map((s, i) => {
          const active = i === activeIdx;
          const done = activeIdx > i;
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex flex-1 items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition ${
                  active
                    ? "bg-primary/15 text-primary"
                    : done
                      ? "bg-primary/8 text-primary/70"
                      : "bg-white/[0.03] text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active
                      ? "bg-primary shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_80%,transparent)] phase-dot"
                      : done
                        ? "bg-primary/60"
                        : "bg-white/15"
                  }`}
                />
                <span className="truncate">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CameraHero({
  previewSrc,
  sourceBadge,
  meal,
  phase,
  onCapture,
  onUpload,
  onRetake,
}: {
  previewSrc: string | null;
  sourceBadge: string | null;
  meal: boolean;
  phase: "idle" | "connected" | "measuring" | "stabilizing" | "capturing" | "processing";
  onCapture: () => void;
  onUpload: () => void;
  onRetake: (() => void) | null;
}) {
  return (
    <div className="relative" data-testid="meal-preview">
      {/* neon glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[26px] bg-gradient-to-br from-primary/40 via-primary/10 to-transparent opacity-60 blur-[2px]" />
      <div className="relative overflow-hidden rounded-[24px] border border-primary/30 bg-black/60 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
        <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
          {previewSrc ? (
            <>
              <img src={previewSrc} alt="Captured meal" className="absolute inset-0 h-full w-full object-cover animate-fade-in" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_60%),radial-gradient(circle_at_80%_80%,color-mix(in_oklab,var(--accent)_15%,transparent),transparent_60%)]" />
              <div className="shimmer absolute inset-0 opacity-30" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_0_30px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
                  <Camera className="h-8 w-8" />
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.22em]">
                  {phase === "stabilizing" ? "Stabilizing…" : phase === "capturing" ? "Capturing…" : "Awaiting Capture"}
                </p>
              </div>
            </>
          )}

          {/* LIVE badge */}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-primary backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {meal ? "Live" : (sourceBadge ?? "Live Feed")}
          </span>

          {onRetake && (
            <button
              type="button"
              onClick={onRetake}
              className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur"
            >
              Retake
            </button>
          )}

          {/* In-preview actions */}
          <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCapture}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/90 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] backdrop-blur transition hover:bg-primary"
            >
              <Camera className="h-3.5 w-3.5" />
              Capture
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/55 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-foreground backdrop-blur transition hover:bg-black/70"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightCard({
  display,
  phase,
  live,
  locked,
}: {
  display: { value: number | string; unit: string };
  phase: "idle" | "connected" | "measuring" | "stabilizing" | "capturing" | "processing";
  live: number | null;
  locked: number | null;
}) {
  const active = phase === "measuring" || phase === "stabilizing" || phase === "capturing";
  // Sparkline: simple animated trend illustration
  const points = "0,18 12,14 24,16 36,10 48,12 60,7 72,10 84,5 96,8";
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-white/[0.02] to-transparent p-4 backdrop-blur-xl"
      data-testid="weight-hero"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Live Weight</p>
            <p className="text-[10px] text-muted-foreground">
              {locked != null ? `Locked at ${locked}g` : live != null ? "Streaming" : "Awaiting reading"}
            </p>
          </div>
        </div>
        {active && (
          <span className="relative flex h-2 w-2 mt-1">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <p className="text-4xl font-bold leading-none tracking-tight tabular-nums text-foreground">
            {typeof display.value === "number" ? display.value : display.value === "Waiting..." ? "0" : display.value}
          </p>
          <span className="text-base font-medium text-muted-foreground">{display.unit || (typeof display.value === "number" ? "g" : "")}</span>
        </div>
        <svg viewBox="0 0 96 24" className="h-8 w-24 text-primary">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          <polyline points={`${points} 96,24 0,24`} fill="currentColor" opacity="0.12" stroke="none" />
        </svg>
      </div>
      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-700 ${phase === "stabilizing" ? "shimmer" : ""}`}
          style={{
            width:
              locked != null
                ? "100%"
                : typeof display.value === "number"
                  ? `${Math.min(100, (display.value / 500) * 100)}%`
                  : "8%",
          }}
        />
      </div>
    </div>
  );
}

function MiniRing({
  value,
  max,
  label,
  display,
  gradient,
  glowColor,
}: {
  value: number;
  max: number;
  label: string;
  display: string;
  gradient: { id: string; from: string; to: string };
  glowColor: string;
}) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, (value / max) * 100);
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <div
            className="absolute inset-2 rounded-full opacity-50 blur-2xl"
            style={{ background: `radial-gradient(circle, ${glowColor}, transparent 70%)` }}
          />
          <svg width={size} height={size} className="relative -rotate-90">
            <defs>
              <linearGradient id={gradient.id} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradient.from} />
                <stop offset="100%" stopColor={gradient.to} />
              </linearGradient>
            </defs>
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={`url(#${gradient.id})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              fill="none"
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-base font-bold tabular-nums">{display}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceCard({ value }: { value: number }) {
  // gradient red→yellow→green based on value
  const from = value >= 80 ? "#22c55e" : value >= 50 ? "#facc15" : "#ef4444";
  const to = value >= 80 ? "#4ade80" : value >= 50 ? "#fb923c" : "#f87171";
  return (
    <MiniRing
      value={value}
      max={100}
      label="Confidence"
      display={`${value}%`}
      gradient={{ id: "confGrad", from, to }}
      glowColor={`color-mix(in oklab, ${from} 55%, transparent)`}
    />
  );
}

function CaloriesCard({ value, goal, pct }: { value: number; goal: number; pct: number }) {
  return (
    <MiniRing
      value={pct}
      max={100}
      label="Calories"
      display={`${value}`}
      gradient={{ id: "calGrad", from: "#fb923c", to: "#f97316" }}
      glowColor="color-mix(in oklab, #fb923c 55%, transparent)"
    />
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: "primary" | "muted" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl">
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-lg font-bold tabular-nums ${accent === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function MacroPanel({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl" data-testid="daily-macros">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Daily Macros</p>
        <p className="text-[9px] text-muted-foreground">Updated live</p>
      </div>
      <div className="space-y-3.5">
        <Macro label="Protein" value={protein} goal={80} color="protein" icon={Dumbbell} />
        <Macro label="Carbs" value={carbs} goal={250} color="carbs" icon={Wheat} />
        <Macro label="Fats" value={fats} goal={70} color="fats" icon={Droplets} />
      </div>
    </div>
  );
}

const RECENT_PLACEHOLDER = [
  { name: "Rice Bowl", weight: 245, confidence: 92, img: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=70" },
  { name: "Dal Tadka", weight: 180, confidence: 88, img: "https://images.unsplash.com/photo-1626500155410-78cd17b3b69e?w=400&q=70" },
  { name: "Salad", weight: 120, confidence: 76, img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=70" },
  { name: "Paneer", weight: 90, confidence: 81, img: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&q=70" },
];

function RecentMeals() {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Recent Meals</p>
        <Link to="/history" className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          View all
        </Link>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2.5 pb-1">
          {RECENT_PLACEHOLDER.map((m) => (
            <div
              key={m.name}
              className="w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
            >
              <div className="relative h-20 w-full overflow-hidden bg-black/40">
                <img src={m.img} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-primary backdrop-blur">
                  {m.confidence}%
                </span>
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">{m.weight}g</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


const FOOD_TONES = [
  { wrap: "bg-[color-mix(in_oklab,var(--chart-1)_14%,black)]", icon: "bg-chart-1/25 text-chart-1" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-2)_14%,black)]", icon: "bg-chart-2/25 text-chart-2" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-3)_14%,black)]", icon: "bg-chart-3/25 text-chart-3" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-4)_14%,black)]", icon: "bg-chart-4/25 text-chart-4" },
  { wrap: "bg-[color-mix(in_oklab,var(--chart-5)_14%,black)]", icon: "bg-chart-5/25 text-chart-5" },
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
      className={`flex flex-col items-center gap-2 rounded-2xl border border-white/10 ${tone.wrap} p-3 text-center backdrop-blur-xl`}
      data-testid="food-card"
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone.icon}`}>
        <UtensilsCrossed className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold leading-tight">{food.name}</p>
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
    protein: "from-macro-protein/70 to-macro-protein",
    carbs: "from-macro-carbs/70 to-macro-carbs",
    fats: "from-macro-fats/70 to-macro-fats",
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
          <span className="text-xs font-semibold">{label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          <span className={`font-bold ${textMap[color]}`}>{value}g</span> / {goal}g
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fromMap[color]} shadow-[0_0_12px_-2px_currentColor] transition-[width] duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

