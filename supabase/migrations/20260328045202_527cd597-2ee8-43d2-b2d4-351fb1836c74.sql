CREATE TABLE public.saved_flight_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  polygon jsonb NOT NULL,
  home_position jsonb,
  params jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_flight_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved flight plans" ON public.saved_flight_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);