import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEYS = ["meal_prefs", "allergies", "restrictions", "notifications", "privacy"] as const;
type Key = (typeof KEYS)[number];

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("meal_prefs, allergies, restrictions, notifications, privacy")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? { meal_prefs: {}, allergies: {}, restrictions: {}, notifications: {}, privacy: {} }
    );
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { section: Key; value: Record<string, unknown> }) =>
    z.object({
      section: z.enum(KEYS),
      value: z.record(z.string(), z.any()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = { user_id: context.userId, [data.section]: data.value } as {
      user_id: string;
      meal_prefs?: unknown; allergies?: unknown; restrictions?: unknown; notifications?: unknown; privacy?: unknown;
    };
    const { error } = await context.supabase
      .from("user_settings")
      .upsert(patch as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; message: string; contact_email?: string }) =>
    z.object({
      subject: z.string().trim().min(2).max(120),
      message: z.string().trim().min(5).max(2000),
      contact_email: z.string().email().max(255).optional().or(z.literal("").transform(() => undefined)),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("support_requests").insert({
      user_id: context.userId,
      subject: data.subject,
      message: data.message,
      contact_email: data.contact_email ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rating: number; message?: string }) =>
    z.object({
      rating: z.number().int().min(1).max(5),
      message: z.string().trim().max(2000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback").insert({
      user_id: context.userId,
      rating: data.rating,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportMealHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("meals")
      .select("captured_at, image_path, total_weight_grams, calories, nutrients, top_label")
      .order("captured_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
