CREATE POLICY "Users can update own questions"
  ON public.questions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);