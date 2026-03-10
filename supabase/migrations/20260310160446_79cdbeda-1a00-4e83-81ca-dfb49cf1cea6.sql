
CREATE TABLE public.task_difficulty_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.diagnostic_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  task_index integer NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'think', 'impossible')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, user_id, task_index)
);

ALTER TABLE public.task_difficulty_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ratings" ON public.task_difficulty_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON public.task_difficulty_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ratings" ON public.task_difficulty_ratings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings" ON public.task_difficulty_ratings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
