
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  question_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own questions"
  ON public.questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own questions"
  ON public.questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all questions"
  ON public.questions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
