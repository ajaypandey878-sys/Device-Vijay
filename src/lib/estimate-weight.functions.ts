import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const estimateWeight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) =>
    z.object({ image: z.string().min(8).max(15_000_000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You estimate the total edible portion weight on a plate from a single photo. Reply ONLY with strict JSON: {\"grams\": number | null}. Use null when no recognizable food is visible or the photo is too ambiguous. Be realistic for a typical single serving (50-1200g).",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Estimate the total food weight in grams." },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Estimation failed (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let grams: number | null = null;
    try {
      const parsed = JSON.parse(content) as { grams?: number | null };
      if (typeof parsed.grams === "number" && Number.isFinite(parsed.grams) && parsed.grams > 0) {
        grams = Math.round(parsed.grams);
      }
    } catch {
      // ignore
    }
    return { grams };
  });
