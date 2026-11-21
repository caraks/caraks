CREATE TABLE public.turing_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration','running','ended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.turing_tests TO authenticated;
GRANT ALL ON public.turing_tests TO service_role;
ALTER TABLE public.turing_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage shareable tests" ON public.turing_tests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.turing_guests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 test_id uuid NOT NULL REFERENCES public.turing_tests(id) ON DELETE CASCADE,
 token uuid NOT NULL,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
 grp text CHECK (grp IN ('A','B')),
 pair_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(test_id,token)
);
GRANT SELECT ON public.turing_guests TO authenticated;
GRANT ALL ON public.turing_guests TO service_role;
ALTER TABLE public.turing_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view guest names" ON public.turing_guests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.turing_guest_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 test_id uuid NOT NULL REFERENCES public.turing_tests(id) ON DELETE CASCADE,
 participant_id uuid NOT NULL REFERENCES public.turing_guests(id) ON DELETE CASCADE,
 pair_id uuid NOT NULL,
 content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.turing_guest_messages TO service_role;
ALTER TABLE public.turing_guest_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX turing_guest_messages_pair ON public.turing_guest_messages(pair_id,created_at);
CREATE OR REPLACE FUNCTION public.turing_admin(p_action text, p_test uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_status text; v_count int; v_b int; v_guest record; v_i int := 0; v_pair uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF p_action = 'create' THEN
  INSERT INTO public.turing_tests(created_by) VALUES(auth.uid()) RETURNING id INTO v_id;
 ELSIF p_action IN ('start','stop') THEN
  SELECT status INTO v_status FROM public.turing_tests WHERE id=p_test FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test not found'; END IF;
  IF p_action='start' THEN
   IF v_status <> 'registration' THEN RAISE EXCEPTION 'Test already started'; END IF;
   SELECT count(*) INTO v_count FROM public.turing_guests WHERE test_id=p_test;
   IF v_count=0 THEN RAISE EXCEPTION 'Register at least one participant'; END IF;
   v_b := (v_count / 2) - ((v_count / 2) % 2);
   FOR v_guest IN SELECT id FROM public.turing_guests WHERE test_id=p_test ORDER BY random() LOOP
    IF v_i < v_b THEN
     IF v_i % 2 = 0 THEN v_pair := gen_random_uuid(); END IF;
     UPDATE public.turing_guests SET grp='B',pair_id=v_pair WHERE id=v_guest.id;
    ELSE
     UPDATE public.turing_guests SET grp='A',pair_id=NULL WHERE id=v_guest.id;
    END IF;
    v_i:=v_i+1;
   END LOOP;
   UPDATE public.turing_tests SET status='running' WHERE id=p_test;
  ELSE
   UPDATE public.turing_tests SET status='ended' WHERE id=p_test;
  END IF;
 ELSIF p_action <> 'list' THEN RAISE EXCEPTION 'Unknown action'; END IF;
 RETURN jsonb_build_object('created_id',v_id,'tests',COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id',t.id,'status',t.status,'created_at',t.created_at,'participants',COALESCE((
   SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'grp',g.grp,'pair_id',g.pair_id) ORDER BY g.created_at,g.id) FROM public.turing_guests g WHERE g.test_id=t.id
  ),'[]'::jsonb)) ORDER BY t.created_at DESC) FROM public.turing_tests t
 ),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.turing_admin(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.turing_admin(text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.turing_guest(p_action text,p_test uuid,p_token uuid DEFAULT NULL,p_name text DEFAULT NULL,p_content text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_guest public.turing_guests; v_name text;
BEGIN
 SELECT status INTO v_status FROM public.turing_tests WHERE id=p_test FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Test not found'; END IF;
 IF p_action='info' THEN RETURN jsonb_build_object('status',v_status); END IF;
 IF p_token IS NULL THEN RAISE EXCEPTION 'Registration required'; END IF;
 SELECT * INTO v_guest FROM public.turing_guests WHERE test_id=p_test AND token=p_token;
 IF p_action='register' AND v_guest.id IS NULL THEN
  IF v_status <> 'registration' THEN RAISE EXCEPTION 'Registration is closed'; END IF;
  v_name:=btrim(p_name);
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Enter a name (1–80 characters)'; END IF;
  INSERT INTO public.turing_guests(test_id,token,name) VALUES(p_test,p_token,v_name) RETURNING * INTO v_guest;
 END IF;
 IF v_guest.id IS NULL THEN RAISE EXCEPTION 'Registration required'; END IF;
 IF p_action='send' THEN
  IF v_status <> 'running' OR v_guest.grp <> 'B' OR v_guest.pair_id IS NULL THEN RAISE EXCEPTION 'Conversation is not active'; END IF;
  IF p_content IS NULL OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
  INSERT INTO public.turing_guest_messages(test_id,participant_id,pair_id,content) VALUES(p_test,v_guest.id,v_guest.pair_id,btrim(p_content));
 ELSIF p_action NOT IN ('state','register') THEN RAISE EXCEPTION 'Unknown action'; END IF;
 RETURN jsonb_build_object('status',v_status,'name',v_guest.name,'kind',CASE WHEN v_guest.grp='B' THEN 'peer' WHEN v_guest.grp='A' THEN 'bot' ELSE NULL END,'messages',COALESCE((
  SELECT jsonb_agg(jsonb_build_object('id',m.id,'mine',m.participant_id=v_guest.id,'content',m.content) ORDER BY m.created_at,m.id)
  FROM public.turing_guest_messages m WHERE m.test_id=p_test AND m.pair_id=v_guest.pair_id
 ),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.turing_guest(text,uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.turing_guest(text,uuid,uuid,text,text) TO anon,authenticated,service_role;
COMMENT ON TABLE public.turing_sessions IS 'Legacy account-based Turing tests; new tests use turing_tests.';