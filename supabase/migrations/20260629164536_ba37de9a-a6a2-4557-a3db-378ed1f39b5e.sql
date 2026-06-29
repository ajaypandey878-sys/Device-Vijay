
-- 1. Devices: add status column (last_seen_at already exists)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline';

-- 2. Meals: add locked_weight + needs_correction; broaden allowed status values
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS locked_weight_grams numeric,
  ADD COLUMN IF NOT EXISTS needs_correction boolean NOT NULL DEFAULT false;

-- Auto-set needs_correction when confidence < 0.8
CREATE OR REPLACE FUNCTION public.set_meal_needs_correction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.top_confidence IS NOT NULL AND NEW.top_confidence < 0.8 THEN
    NEW.needs_correction := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meals_needs_correction ON public.meals;
CREATE TRIGGER meals_needs_correction
  BEFORE INSERT OR UPDATE OF top_confidence ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_meal_needs_correction();

-- 3. Nutrition database (shared reference data)
CREATE TABLE IF NOT EXISTS public.nutrition_db (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_name text NOT NULL UNIQUE,
  kcal_per_100g numeric NOT NULL,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fats_g numeric NOT NULL DEFAULT 0,
  density numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nutrition_db TO authenticated;
GRANT ALL ON public.nutrition_db TO service_role;

ALTER TABLE public.nutrition_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_db readable by authenticated"
  ON public.nutrition_db FOR SELECT TO authenticated USING (true);

-- Preload reference foods (per 100g, approximate values; density g/ml)
INSERT INTO public.nutrition_db (food_name, kcal_per_100g, protein_g, carbs_g, fats_g, density) VALUES
  ('Rice',   130, 2.7,  28.0, 0.3, 0.85),
  ('Dal',    116, 9.0,  20.0, 0.4, 1.00),
  ('Roti',   297, 11.0, 46.0, 7.5, 0.55),
  ('Sabzi',   90, 3.0,  10.0, 4.5, 0.70),
  ('Paneer', 265, 18.0, 1.2, 20.0, 1.05),
  ('Curd',    98, 11.0, 3.4,  4.3, 1.03),
  ('Salad',   25, 1.2,  4.8,  0.2, 0.50),
  ('Fruit',   60, 0.6,  15.0, 0.2, 0.90)
ON CONFLICT (food_name) DO NOTHING;
