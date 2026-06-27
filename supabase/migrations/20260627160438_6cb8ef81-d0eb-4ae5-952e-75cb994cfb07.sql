
CREATE TABLE public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  food_name TEXT NOT NULL,
  weight_grams NUMERIC,
  calories NUMERIC,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX meal_items_meal_id_idx ON public.meal_items(meal_id);
CREATE INDEX meal_items_user_id_idx ON public.meal_items(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;
GRANT ALL ON public.meal_items TO service_role;

ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own meal items"
  ON public.meal_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
