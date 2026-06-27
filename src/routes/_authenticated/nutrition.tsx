import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMeals } from "@/lib/meals.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, startOfDay, subDays, eachDayOfInterval } from "date-fns";

export const Route = createFileRoute("/_authenticated/nutrition")({
  head: () => ({ meta: [{ title: "Nutrition — Smart Deck" }] }),
  component: Nutrition,
});

function Nutrition() {
  const [range, setRange] = useState<"week" | "month">("week");
  const days = range === "week" ? 7 : 30;
  const fetchMeals = useServerFn(listMeals);
  const { data: meals } = useQuery({
    queryKey: ["meals", "nutrition", days],
    queryFn: () => fetchMeals({ data: { sinceDays: days, limit: 500 } }),
  });

  const series = useMemo(() => {
    const end = startOfDay(new Date());
    const start = subDays(end, days - 1);
    const buckets = new Map<string, { day: string; calories: number; protein: number; carbs: number; fat: number }>();
    for (const d of eachDayOfInterval({ start, end })) {
      const key = format(d, "yyyy-MM-dd");
      buckets.set(key, { day: format(d, days <= 7 ? "EEE" : "d MMM"), calories: 0, protein: 0, carbs: 0, fat: 0 });
    }
    for (const m of meals ?? []) {
      const key = format(new Date(m.captured_at), "yyyy-MM-dd");
      const b = buckets.get(key);
      if (!b) continue;
      b.calories += Number(m.calories ?? 0);
      const n = (m.nutrients ?? {}) as Record<string, number>;
      b.protein += Number(n.protein_g ?? 0);
      b.carbs += Number(n.carbs_g ?? 0);
      b.fat += Number(n.fat_g ?? 0);
    }
    return Array.from(buckets.values());
  }, [meals, days]);

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const r of series) { t.calories += r.calories; t.protein += r.protein; t.carbs += r.carbs; t.fat += r.fat; }
    return t;
  }, [series]);

  const macros = [
    { name: "Protein", value: totals.protein, color: "var(--color-chart-1)" },
    { name: "Carbs", value: totals.carbs, color: "var(--color-chart-2)" },
    { name: "Fat", value: totals.fat, color: "var(--color-chart-3)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nutrition dashboard</h1>
          <p className="text-sm text-muted-foreground">Trends across your captured meals.</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Calories" value={Math.round(totals.calories)} unit="kcal" />
        <Stat label="Protein" value={Math.round(totals.protein)} unit="g" />
        <Stat label="Carbs" value={Math.round(totals.carbs)} unit="g" />
        <Stat label="Fat" value={Math.round(totals.fat)} unit="g" />
      </div>

      <Card><CardContent className="p-4">
        <h2 className="mb-3 font-semibold">Calories per day</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="calories" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Macros per day (g)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="protein" stackId="a" fill="var(--color-chart-1)" />
                <Bar dataKey="carbs" stackId="a" fill="var(--color-chart-2)" />
                <Bar dataKey="fat" stackId="a" fill="var(--color-chart-3)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <h2 className="mb-3 font-semibold">Macro split</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={macros} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {macros.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}<span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span></p>
    </CardContent></Card>
  );
}
