CREATE TABLE public.turing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turing_sessions TO authenticated;
GRANT ALL ON public.turing_sessions TO service_role;
ALTER TABLE public.turing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sessions" ON public.turing_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert sessions" ON public.turing_sessions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update sessions" ON public.turing_sessions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete sessions" ON public.turing_sessions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.turing_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.turing_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  grp text NOT NULL,
  pair_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turing_assignments TO authenticated;
GRANT ALL ON public.turing_assignments TO service_role;
ALTER TABLE public.turing_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assignment" ON public.turing_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert assignments" ON public.turing_assignments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update assignments" ON public.turing_assignments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete assignments" ON public.turing_assignments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.turing_is_pair_member(_pair_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turing_assignments
    WHERE pair_id = _pair_id AND user_id = _user_id
  )
$$;

CREATE TABLE public.turing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.turing_sessions(id) ON DELETE CASCADE,
  pair_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  sender_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turing_messages TO authenticated;
GRANT ALL ON public.turing_messages TO service_role;
ALTER TABLE public.turing_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pair members and admins can view messages" ON public.turing_messages FOR SELECT TO authenticated USING (public.turing_is_pair_member(pair_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Pair members can send messages" ON public.turing_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.turing_is_pair_member(pair_id, auth.uid()));
CREATE POLICY "Admins can delete messages" ON public.turing_messages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_turing_sessions_updated_at BEFORE UPDATE ON public.turing_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_turing_messages_pair ON public.turing_messages(pair_id, created_at);
CREATE INDEX idx_turing_assignments_session ON public.turing_assignments(session_id);

ALTER TABLE public.turing_messages REPLICA IDENTITY FULL;
ALTER TABLE public.turing_assignments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turing_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turing_assignments;