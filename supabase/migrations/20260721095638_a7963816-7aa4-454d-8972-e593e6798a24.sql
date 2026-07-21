
CREATE TABLE public.explain_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.explain_conversations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.explain_conversations TO authenticated;
GRANT ALL ON public.explain_conversations TO service_role;

ALTER TABLE public.explain_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert explain conversations"
  ON public.explain_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update explain conversations"
  ON public.explain_conversations FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view explain conversations"
  ON public.explain_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete explain conversations"
  ON public.explain_conversations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_explain_conversations_updated_at
  BEFORE UPDATE ON public.explain_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
