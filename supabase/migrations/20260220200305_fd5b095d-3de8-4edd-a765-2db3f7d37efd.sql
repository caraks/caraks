
ALTER TABLE public.questions ADD COLUMN ai_topic text DEFAULT NULL;
ALTER TABLE public.questions ADD COLUMN ai_questions jsonb DEFAULT NULL;
