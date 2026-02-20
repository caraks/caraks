
ALTER TABLE public.polls ADD COLUMN allow_free_text boolean NOT NULL DEFAULT false;
ALTER TABLE public.poll_votes ADD COLUMN free_text text;
