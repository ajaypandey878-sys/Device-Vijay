import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals, correctMeal, deleteMeal } from "@/lib/meals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MealImage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Smart Deck" }] }),
  component: History,
});

function History() {
  const fetchMeals = useServerFn(listMeals);
  const { data: meals, isLoading } = useQuery({
    queryKey: ["meals", "history"],
    queryFn: () => fetchMeals({ data: { sinceDays: 60, limit: 200 } }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meal history</h1>
        <p className="text-sm text-muted-foreground">Edit predictions or remove false detections — corrections improve future predictions.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : meals && meals.length > 0 ? (
        <div className="space-y-3">
          {meals.map((m) => <MealRow key={m.id} meal={m} />)}
        </div>
      ) : (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No meals captured yet.</CardContent></Card>
      )}
    </div>
  );
}

function MealRow({ meal }: { meal: any }) {
  const label = meal.corrected_label ?? meal.top_label ?? "Unknown";
  const weight = meal.corrected_weight_grams ?? meal.total_weight_grams;
  const wasCorrected = meal.corrected_label || meal.corrected_weight_grams;
  return (
    <Card>
      <div className="grid grid-cols-[96px_1fr_auto] gap-4 p-3 sm:grid-cols-[120px_1fr_auto]">
        <div className="overflow-hidden rounded-lg"><MealImage path={meal.image_path} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-medium">{label}</h3>
            {wasCorrected && <Badge variant="secondary">corrected</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{format(new Date(meal.captured_at), "EEE, MMM d • p")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {weight != null && <Badge variant="outline">{Math.round(Number(weight))} g</Badge>}
            {meal.calories != null && <Badge variant="outline">{Math.round(meal.calories)} kcal</Badge>}
            {meal.top_confidence != null && <Badge variant="outline">{Math.round(meal.top_confidence * 100)}%</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <EditDialog meal={meal} />
          <DeleteButton id={meal.id} />
        </div>
      </div>
    </Card>
  );
}

function EditDialog({ meal }: { meal: any }) {
  const qc = useQueryClient();
  const submit = useServerFn(correctMeal);
  const [open, setOpen] = useState(false);
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
      qc.invalidateQueries({ queryKey: ["meals"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="mr-1 h-3.5 w-3.5" /> Correct</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Correct this meal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="label">Food name</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
            {meal.predictions && Array.isArray(meal.predictions) && (
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
            <p className="mt-1 text-xs text-muted-foreground">Calories and nutrients will rescale automatically.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const submit = useServerFn(deleteMeal);
  const mutation = useMutation({
    mutationFn: () => submit({ data: { id } }),
    onSuccess: () => { toast.success("Meal removed"); qc.invalidateQueries({ queryKey: ["meals"] }); },
    onError: (e: any) => toast.error(e.message ?? "Could not delete"),
  });
  return (
    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this meal?")) mutation.mutate(); }} disabled={mutation.isPending}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
