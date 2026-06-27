
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEVICES
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Smart Deck',
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own devices" ON public.devices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX devices_user_idx ON public.devices(user_id);

-- MEALS
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  image_path TEXT,
  weights_grams JSONB NOT NULL DEFAULT '[]'::jsonb, -- [w1,w2,w3,w4]
  total_weight_grams NUMERIC,
  depth_mm NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  predictions JSONB,        -- [{label, confidence}, ...]
  top_label TEXT,
  top_confidence NUMERIC,
  calories NUMERIC,         -- kcal for total_weight
  nutrients JSONB,          -- {protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, ...}
  corrected_label TEXT,
  corrected_weight_grams NUMERIC,
  status TEXT NOT NULL DEFAULT 'processed', -- processed | failed | pending
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own meals" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own meals" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own meals" ON public.meals FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX meals_user_time_idx ON public.meals(user_id, captured_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;

-- MEAL CORRECTIONS (feedback log)
CREATE TABLE public.meal_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  original_label TEXT,
  corrected_label TEXT,
  original_weight_grams NUMERIC,
  corrected_weight_grams NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_corrections TO authenticated;
GRANT ALL ON public.meal_corrections TO service_role;
ALTER TABLE public.meal_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own corrections" ON public.meal_corrections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX corrections_user_idx ON public.meal_corrections(user_id, created_at DESC);
