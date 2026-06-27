import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeal, correctMeal, deleteMeal } from "@/lib/meals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Flame, Scale, Ruler, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { MealImage } from "./dashboard";

export const Route = createFileRoute("/meal/$id")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "Meal — Smart Deck" }] }),
  component: () => <AppShell><MealDetail /></AppShell>,
});

function MealDetail() {
  const { id } = Route.useParams();
  const fetchMeal = useServerFn(getMeal);
  const { data: meal, isLoading } = useQuery({
    queryKey: ["meal", id],
    queryFn: () => fetchMeal({ data: { id } }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!meal) return <p className="text-sm text-muted-foreground">Meal not found.</p>;

  return (
    <div className="space-y-6">
      <Link to="/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </Link>

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1fr]">
          <MealImage path={meal.image_path} />
          <CardContent className="space-y-4 p-6">
            <Badge variant="secondary" className="w-fit">{format(new Date(meal.captured_at), "EEE, MMM d • p")}</Badge>
            <h1 className="text-3xl font-semibold">{meal.corrected_label ?? meal.top_label ?? "Unknown"}</h1>
            <div className="grid grid-cols-3 gap-3">
              <Metric icon={Flame} label="Calories" value={meal.calories != null ? `${Math.round(meal.calories)} kcal` : "—"} />
              <Metric icon={Scale} label="Weight" value={(meal.corrected_weight_grams ?? meal.total_weight_grams) != null ? `${Math.round(Number(meal.corrected_weight_grams ?? meal.total_weight_grams))} g` : "—"} />
              <Metric icon={Ruler} label="Depth" value={meal.depth_mm != null ? `${Math.round(Number(meal.depth_mm))} mm` : "—"} />
            </div>
            {meal.nutrients && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(meal.nutrients as Record<string, number>).map(([k, v]) => (
                  <Badge key={k} variant="outline">{prettyKey(k)} {Math.round(v)}{k.endsWith("_mg") ? "mg" : "g"}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      <CorrectForm meal={meal} />
      <DangerZone id={meal.id} />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span></div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function CorrectForm({ meal }: { meal: any }) {
  const qc = useQueryClient();
  const submit = useServerFn(correctMeal);
  const [label, setLabel] = useState<string>(meal.corrected_label ?? meal.top_label ?? "");
  const [weight, setWeight] = useState<string>(String(meal.corrected_weight_grams ?? meal.total_weight_grams ?? ""));

  const mutation = useMutation({
    mutationFn: () => submit({ data: {
      id: meal.id,
      corrected_label: label.trim() || null,
      corrected_weight_grams: weight ? Number(weight) : null,
    }}),
    onSuccess: () => {
      toast.success("Saved. Thanks for the correction.");
      qc.invalidateQueries({ queryKey: ["meal", meal.id] });
      qc.invalidateQueries({ queryKey: ["meals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  return (
    <Card><CardContent className="space-y-4 p-5">
      <h2 className="font-semibold">Correct this meal</h2>
      <div>
        <Label htmlFor="label">Food name</Label>
        <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
        {Array.isArray(meal.predictions) && meal.predictions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(meal.predictions as Array<{ label: string; confidence: number }>).map((p) => (
              <button key={p.label} type="button" onClick={() => setLabel(p.label)}
                className="rounded-full bg-secondary px-2 py-1 text-xs hover:bg-secondary/70">
                {p.label} · {Math.round(p.confidence * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="weight">Weight (grams)</Label>
        <Input id="weight" type="number" min={0} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Calories and nutrients rescale automatically.</p>
      </div>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save correction"}
      </Button>
    </CardContent></Card>
  );
}

function DangerZone({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(deleteMeal);
  const mutation = useMutation({
    mutationFn: () => submit({ data: { id } }),
    onSuccess: () => {
      toast.success("Meal removed");
      qc.invalidateQueries({ queryKey: ["meals"] });
      navigate({ to: "/history" });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete"),
  });
  return (
    <Card><CardContent className="flex items-center justify-between p-5">
      <div>
        <h2 className="font-semibold">Delete meal</h2>
        <p className="text-sm text-muted-foreground">This removes the meal and its image.</p>
      </div>
      <Button variant="destructive" onClick={() => { if (confirm("Delete this meal?")) mutation.mutate(); }} disabled={mutation.isPending}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete
      </Button>
    </CardContent></Card>
  );
}

function prettyKey(k: string) {
  return k.replace(/_g$|_mg$/, "").replace(/_/g, " ");
}
