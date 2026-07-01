import { useEffect, useState, useSyncExternalStore } from "react";

export type Goal = "lose" | "gain" | "maintain" | "healthier";
export type Gender = "male" | "female" | "other";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "athlete";

export type UserProfile = {
  goal: Goal;
  age: number;
  weightKg: number;
  heightCm: number;
  gender: Gender;
  activity: Activity;
  allergies?: string;
  restrictions?: string;
  createdAt: string;
};

const STORAGE_KEY = "ashoma.profile.v1";

const GOAL_META: Record<Goal, { label: string; subtitle: string; emoji: string; kcalDelta: number; proteinPerKg: number }> = {
  lose: { label: "Lose Weight", subtitle: "Burn fat and stay in calorie deficit", emoji: "🔥", kcalDelta: -400, proteinPerKg: 1.8 },
  gain: { label: "Gain Muscle", subtitle: "Increase protein and build lean mass", emoji: "💪", kcalDelta: 350, proteinPerKg: 2.0 },
  maintain: { label: "Maintain Weight", subtitle: "Keep calories balanced and stay consistent", emoji: "⚖️", kcalDelta: 0, proteinPerKg: 1.4 },
  healthier: { label: "Eat Healthier", subtitle: "Improve meal quality and nutrition habits", emoji: "🥗", kcalDelta: -100, proteinPerKg: 1.5 },
};

const ACTIVITY_MULT: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export function goalMeta(goal: Goal) { return GOAL_META[goal]; }
export function allGoals() { return Object.entries(GOAL_META).map(([k, v]) => ({ id: k as Goal, ...v })); }

export type Targets = { kcal: number; proteinG: number; carbsG: number; fatsG: number };

export function computeTargets(p: UserProfile): Targets {
  // Mifflin-St Jeor
  const s = p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s;
  const tdee = bmr * ACTIVITY_MULT[p.activity];
  const meta = GOAL_META[p.goal];
  const kcal = Math.max(1200, Math.round((tdee + meta.kcalDelta) / 10) * 10);
  const proteinG = Math.round(p.weightKg * meta.proteinPerKg);
  const fatsG = Math.round((kcal * 0.28) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatsG * 9) / 4));
  return { kcal, proteinG, carbsG, fatsG };
}

// tiny external store so multiple components stay in sync
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

function read(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function saveProfile(p: Omit<UserProfile, "createdAt"> & Partial<Pick<UserProfile, "createdAt">>) {
  const full: UserProfile = { createdAt: new Date().toISOString(), ...p };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  emit();
  return full;
}

export function clearProfile() {
  window.localStorage.removeItem(STORAGE_KEY);
  emit();
}

export function useProfile(): UserProfile | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => null,
  );
}

export function useTargets(): Targets {
  const p = useProfile();
  const [t, setT] = useState<Targets>({ kcal: 2000, proteinG: 80, carbsG: 250, fatsG: 70 });
  useEffect(() => { if (p) setT(computeTargets(p)); }, [p]);
  return t;
}

export function insightFor(goal: Goal | undefined, consumed: number, protein: number, targets: Targets): string {
  const remaining = Math.max(0, targets.kcal - consumed);
  const proteinLeft = Math.max(0, targets.proteinG - protein);
  switch (goal) {
    case "gain":
      return proteinLeft > 5
        ? `You need ${proteinLeft}g more protein today`
        : `Great protein intake — keep the surplus consistent`;
    case "lose":
      return consumed > targets.kcal
        ? `You are ${consumed - targets.kcal} kcal over your deficit`
        : `You have ${remaining} kcal left today`;
    case "maintain":
      return Math.abs(consumed - targets.kcal) < 150
        ? `You are within your calorie balance`
        : `Aim for ~${targets.kcal} kcal — currently ${consumed}`;
    case "healthier":
      return proteinLeft > 10
        ? `Try increasing protein intake by ${proteinLeft}g`
        : `Nice balance — keep meal quality up`;
    default:
      return `${remaining} kcal left of your ${targets.kcal} kcal goal`;
  }
}
