
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.bot_state (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bot_state TO authenticated;
GRANT ALL ON public.bot_state TO service_role;

ALTER TABLE public.bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_state read authenticated"
  ON public.bot_state FOR SELECT
  TO authenticated
  USING (true);
-- writes only via service_role (edge function); no INSERT/UPDATE policies for regular users.
