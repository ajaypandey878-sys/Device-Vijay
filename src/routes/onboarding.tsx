import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allGoals, saveProfile, type Goal, type Gender, type Activity } from "@/lib/user-profile";
import { requireAuthBeforeLoad } from "@/components/app-shell";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Welcome — AshoMa" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [gender, setGender] = useState<Gender>("male");
  const [activity, setActivity] = useState<Activity>("moderate");
  const [age, setAge] = useState("28");
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("172");

  function finish() {
    if (!goal) return;
    saveProfile({
      goal,
      age: Number(age) || 28,
      weightKg: Number(weight) || 70,
      heightCm: Number(height) || 172,
      gender,
      activity,
    });
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-success text-primary-foreground text-[11px] font-black tracking-tighter">AM</span>
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] uppercase">AshoMa</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Setup · Step {step + 1} of 2</p>
          </div>
        </div>

        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: step === 0 ? "50%" : "100%" }} />
        </div>

        {step === 0 ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">What is your primary goal?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Personalizes your targets and insights.</p>
            <div className="mt-6 space-y-3">
              {allGoals().map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition",
                    goal === g.id
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_30px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  )}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/40 text-xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{g.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{g.subtitle}</p>
                  </div>
                  <span className={cn("grid h-6 w-6 place-items-center rounded-full border", goal === g.id ? "border-primary bg-primary text-primary-foreground" : "border-white/15")}>
                    {goal === g.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <Button size="lg" disabled={!goal} onClick={() => setStep(1)} className="h-12 w-full rounded-xl text-sm font-semibold">
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Tell us about you</h1>
            <p className="mt-1 text-sm text-muted-foreground">We use this to calculate your daily targets.</p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Age" value={age} onChange={setAge} suffix="yr" />
                <NumField label="Weight" value={weight} onChange={setWeight} suffix="kg" />
                <NumField label="Height" value={height} onChange={setHeight} suffix="cm" />
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Gender</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["male", "female", "other"] as Gender[]).map((g) => (
                    <Chip key={g} active={gender === g} onClick={() => setGender(g)}>{g}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Activity level</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([
                    ["sedentary", "Sedentary"],
                    ["light", "Light"],
                    ["moderate", "Moderate"],
                    ["active", "Active"],
                    ["athlete", "Athlete"],
                  ] as [Activity, string][]).map(([id, label]) => (
                    <Chip key={id} active={activity === id} onClick={() => setActivity(id)}>{label}</Chip>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 pt-8">
              <Button variant="outline" size="lg" onClick={() => setStep(0)} className="h-12 rounded-xl border-white/10 bg-white/[0.03]">
                Back
              </Button>
              <Button size="lg" onClick={finish} className="h-12 rounded-xl text-sm font-semibold">
                Finish
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-2 flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3">
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs font-semibold capitalize transition",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
