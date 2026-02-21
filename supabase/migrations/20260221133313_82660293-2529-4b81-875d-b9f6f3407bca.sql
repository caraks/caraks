
CREATE TABLE public.ai_settings (
  id text PRIMARY KEY DEFAULT 'default',
  system_prompt text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read and update
CREATE POLICY "Admins can select ai_settings" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ai_settings" ON public.ai_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert ai_settings" ON public.ai_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Edge function needs to read via service role, so also allow anon select for function invoke
CREATE POLICY "Anyone authenticated can read ai_settings" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.ai_settings (id, system_prompt) VALUES (
  'default',
  'Ты помощник учителя. Ученик задаёт тебе интересующую его тему, а ты должен придумать пять вопросов — от простого к сложному. Чтобы понять, что именно ученик не знает. Выдавай ответ в виде JSON: {"questions": ["вопрос1", "вопрос2", "вопрос3", "вопрос4", "вопрос5"]}'
);
