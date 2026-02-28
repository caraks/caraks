
-- Table for admin-created diagnostic quizzes
CREATE TABLE public.diagnostic_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnostic_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quizzes" ON public.diagnostic_quizzes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active quizzes" ON public.diagnostic_quizzes
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Table for student responses
CREATE TABLE public.diagnostic_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.diagnostic_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, user_id)
);

ALTER TABLE public.diagnostic_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own responses" ON public.diagnostic_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses" ON public.diagnostic_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.diagnostic_responses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all responses" ON public.diagnostic_responses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete responses" ON public.diagnostic_responses
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
