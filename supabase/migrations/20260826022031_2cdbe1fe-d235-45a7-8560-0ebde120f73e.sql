CREATE TABLE public.project_crm (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rpic_name text,
  rpic_cert text,
  pmc_name text,
  visual_observers text[] NOT NULL DEFAULT '{}',
  crew_briefing text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  hazardous_attitudes jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_crm TO authenticated;
GRANT ALL ON public.project_crm TO service_role;

ALTER TABLE public.project_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their project CRM"
ON public.project_crm FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_project_crm_updated_at
BEFORE UPDATE ON public.project_crm
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();