CREATE TABLE public.ground_control_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  elevation double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ground_control_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own GCPs" ON public.ground_control_points
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);