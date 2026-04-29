CREATE TABLE public.admin_lesson_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  topic text NOT NULL DEFAULT '',
  lecture text NOT NULL DEFAULT '',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_lesson_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own drafts"
ON public.admin_lesson_drafts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins can insert own drafts"
ON public.admin_lesson_drafts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins can update own drafts"
ON public.admin_lesson_drafts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins can delete own drafts"
ON public.admin_lesson_drafts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE TRIGGER update_admin_lesson_drafts_updated_at
BEFORE UPDATE ON public.admin_lesson_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();