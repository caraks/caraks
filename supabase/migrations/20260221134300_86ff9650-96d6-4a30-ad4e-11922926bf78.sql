
-- Create question_replies table for dialogue
CREATE TABLE public.question_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_replies ENABLE ROW LEVEL SECURITY;

-- Students can see replies on their own questions
CREATE POLICY "Users can view replies on own questions"
  ON public.question_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- Admins can view all replies
CREATE POLICY "Admins can view all replies"
  ON public.question_replies FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert their own replies
CREATE POLICY "Users can insert own replies"
  ON public.question_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can insert replies
CREATE POLICY "Admins can insert replies"
  ON public.question_replies FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for instant messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_replies;
