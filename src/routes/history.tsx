import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals } from "@/lib/meals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AppShell, requireAuthBeforeLoad } from "@/components/app-shell";
import { MealImage } from "./dashboard";

export const Route = createFileRoute("/history")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "History — Smart Deck" }] }),
  component: () => <AppShell><History /></AppShell>,
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
        <p className="text-sm text-muted-foreground">Tap a meal to view details or correct its label and weight.</p>
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
    <Link to="/meal/$id" params={{ id: meal.id }}>
      <Card className="transition hover:shadow-md">
        <div className="grid grid-cols-[96px_1fr] gap-4 p-3 sm:grid-cols-[120px_1fr]">
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
        </div>
      </Card>
    </Link>
  );
}
