import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
