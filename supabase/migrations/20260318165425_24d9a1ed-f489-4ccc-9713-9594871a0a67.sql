CREATE POLICY "Users can delete own questions"
ON public.questions
FOR DELETE
TO public
USING (auth.uid() = user_id);