import { Sparkles } from "lucide-react";
import { goalMeta, insightFor, useProfile, useTargets } from "@/lib/user-profile";

export function InsightCard({ consumed, protein }: { consumed: number; protein: number }) {
  const p = useProfile();
  const targets = useTargets();
  const message = insightFor(p?.goal, consumed, protein, targets);
  const meta = p ? goalMeta(p.goal) : null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 via-white/[0.02] to-transparent p-4 backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              {meta ? `${meta.label} · Insight` : "Today's Insight"}
            </p>
            {meta && <span className="text-xs">{meta.emoji}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
