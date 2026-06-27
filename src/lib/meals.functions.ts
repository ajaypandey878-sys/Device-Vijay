import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const foodItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weight: z.number().nonnegative().max(10000),
  calories: z.number().nonnegative().max(20000),
});

export const saveMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    foods: { name: string; weight: number; calories: number }[];
    total_calories: number;
    protein: number;
    carbs: number;
    fats: number;
    confidence: number;
    image_url?: string | null;
  }) =>
    z.object({
      foods: z.array(foodItemSchema).min(1).max(20),
      total_calories: z.number().nonnegative().max(50000),
      protein: z.number().nonnegative().max(1000),
      carbs: z.number().nonnegative().max(1000),
      fats: z.number().nonnegative().max(1000),
      confidence: z.number().min(0).max(100),
      image_url: z.string().url().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const totalWeight = data.foods.reduce((s, f) => s + f.weight, 0);
    const topFood = [...data.foods].sort((a, b) => b.calories - a.calories)[0];
    const topLabel = data.foods.map((f) => f.name).join(" + ");

    const { data: meal, error } = await context.supabase
      .from("meals")
      .insert({
        user_id: context.userId,
        image_path: data.image_url ?? null,
        weights_grams: data.foods.map((f) => f.weight),
        total_weight_grams: totalWeight,
        top_label: topLabel,
        top_confidence: data.confidence / 100,
        calories: data.total_calories,
        nutrients: {
          protein_g: data.protein,
          carbs_g: data.carbs,
          fat_g: data.fats,
        },
        predictions: { foods: data.foods, top: topFood?.name ?? null },
        status: "processed",
      })
      .select("id")
      .single();
    if (error || !meal) throw new Error(error?.message ?? "Failed to save meal");

    const items = data.foods.map((f, i) => ({
      meal_id: meal.id,
      user_id: context.userId,
      food_name: f.name,
      weight_grams: f.weight,
      calories: f.calories,
      position: i,
    }));
    const { error: itemsErr } = await context.supabase.from("meal_items").insert(items);
    if (itemsErr) throw new Error(itemsErr.message);

    return { id: meal.id };
  });

export const listMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sinceDays?: number; limit?: number }) =>
    z.object({ sinceDays: z.number().int().positive().max(365).optional(), limit: z.number().int().positive().max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("meals")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.sinceDays) {
      const since = new Date(Date.now() - data.sinceDays * 86400000).toISOString();
      q = q.gte("captured_at", since);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMeal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("meals").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMealImageUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("meal-images")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return signed.signedUrl;
  });

export const correctMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    corrected_label?: string | null;
    corrected_weight_grams?: number | null;
  }) =>
    z.object({
      id: z.string().uuid(),
      corrected_label: z.string().trim().min(1).max(120).nullable().optional(),
      corrected_weight_grams: z.number().nonnegative().max(10000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: meal, error: e0 } = await context.supabase
      .from("meals").select("*").eq("id", data.id).single();
    if (e0 || !meal) throw new Error(e0?.message ?? "Meal not found");

    const newLabel = data.corrected_label ?? meal.corrected_label;
    const newWeight = data.corrected_weight_grams ?? meal.corrected_weight_grams;

    // Recompute calories/nutrients proportionally if the weight changed.
    let calories = meal.calories;
    let nutrients = meal.nutrients;
    const baseWeight = Number(meal.total_weight_grams ?? 0);
    if (newWeight != null && baseWeight > 0 && newWeight !== baseWeight && meal.calories != null) {
      const ratio = Number(newWeight) / baseWeight;
      calories = Number(meal.calories) * ratio;
      if (meal.nutrients && typeof meal.nutrients === "object") {
        const scaled: Record<string, number> = {};
        for (const [k, v] of Object.entries(meal.nutrients as Record<string, unknown>)) {
          if (typeof v === "number") scaled[k] = v * ratio;
        }
        nutrients = scaled;
      }
    }

    const { error } = await context.supabase
      .from("meals")
      .update({
        corrected_label: newLabel,
        corrected_weight_grams: newWeight,
        calories,
        nutrients,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Log feedback for "improve future predictions"
    await context.supabase.from("meal_corrections").insert({
      user_id: context.userId,
      meal_id: data.id,
      original_label: meal.top_label,
      corrected_label: newLabel,
      original_weight_grams: meal.total_weight_grams,
      corrected_weight_grams: newWeight,
    });

    return { ok: true };
  });

export const deleteMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Best-effort image cleanup
    const { data: meal } = await context.supabase.from("meals").select("image_path").eq("id", data.id).single();
    if (meal?.image_path) {
      await context.supabase.storage.from("meal-images").remove([meal.image_path]);
    }
    const { error } = await context.supabase.from("meals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
