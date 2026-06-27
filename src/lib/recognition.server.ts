// Food recognition stub. Replace the body of `recognizeFood` with a real
// LogMeal call once the LOGMEAL_API_TOKEN secret is added.
//
// LogMeal docs: https://logmeal.com/api/docs/
// Expected real flow (rough):
//   const fd = new FormData();
//   fd.append("image", new Blob([imageBytes], { type: "image/jpeg" }));
//   const res = await fetch("https://api.logmeal.com/v2/image/segmentation/complete", {
//     method: "POST",
//     headers: { Authorization: `Bearer ${process.env.LOGMEAL_API_TOKEN}` },
//     body: fd,
//   });
//   ...then call /v2/recipe/nutritionalInfo for nutrients.

export type Prediction = { label: string; confidence: number };
export type RecognitionResult = {
  predictions: Prediction[];
  top_label: string;
  top_confidence: number;
  // per 100g
  caloriesPer100g: number;
  nutrientsPer100g: Record<string, number>;
};

const STUB_FOODS: RecognitionResult[] = [
  {
    predictions: [
      { label: "Grilled chicken salad", confidence: 0.82 },
      { label: "Caesar salad", confidence: 0.61 },
      { label: "Cobb salad", confidence: 0.44 },
    ],
    top_label: "Grilled chicken salad",
    top_confidence: 0.82,
    caloriesPer100g: 145,
    nutrientsPer100g: { protein_g: 14, carbs_g: 4, fat_g: 8, fiber_g: 2, sugar_g: 2, sodium_mg: 320 },
  },
  {
    predictions: [
      { label: "Vegetable biryani", confidence: 0.78 },
      { label: "Pulao", confidence: 0.55 },
    ],
    top_label: "Vegetable biryani",
    top_confidence: 0.78,
    caloriesPer100g: 168,
    nutrientsPer100g: { protein_g: 4, carbs_g: 28, fat_g: 5, fiber_g: 2, sugar_g: 3, sodium_mg: 410 },
  },
  {
    predictions: [
      { label: "Margherita pizza", confidence: 0.86 },
      { label: "Cheese pizza", confidence: 0.71 },
    ],
    top_label: "Margherita pizza",
    top_confidence: 0.86,
    caloriesPer100g: 266,
    nutrientsPer100g: { protein_g: 11, carbs_g: 33, fat_g: 10, fiber_g: 2, sugar_g: 4, sodium_mg: 598 },
  },
];

export async function recognizeFood(_imageBytes?: Uint8Array): Promise<RecognitionResult> {
  // TODO: replace with real LogMeal request when LOGMEAL_API_TOKEN is configured.
  await new Promise((r) => setTimeout(r, 50));
  return STUB_FOODS[Math.floor(Math.random() * STUB_FOODS.length)];
}

export function scaleNutrients(result: RecognitionResult, totalGrams: number) {
  const ratio = totalGrams / 100;
  const calories = result.caloriesPer100g * ratio;
  const nutrients: Record<string, number> = {};
  for (const [k, v] of Object.entries(result.nutrientsPer100g)) nutrients[k] = v * ratio;
  return { calories, nutrients };
}
