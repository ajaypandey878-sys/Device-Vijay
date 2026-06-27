
-- Allow user-inserted meals (device ingest uses service role and bypasses RLS)
CREATE POLICY "users insert own meals" ON public.meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage RLS for meal-images: object path must start with "<user_id>/"
CREATE POLICY "users read own meal images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users upload own meal images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own meal images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meal-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Lock down trigger function (warns from linter)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
