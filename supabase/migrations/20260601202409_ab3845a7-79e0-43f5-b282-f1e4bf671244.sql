
CREATE TABLE public.project_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pin','distance','area','volume','rectangle')),
  label TEXT,
  body TEXT,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  measurement JSONB,
  color TEXT DEFAULT '#22c55e',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_annotations_project ON public.project_annotations(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_annotations TO authenticated;
GRANT ALL ON public.project_annotations TO service_role;

ALTER TABLE public.project_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners read annotations"
ON public.project_annotations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "Project owners insert annotations"
ON public.project_annotations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "Author updates annotation"
ON public.project_annotations FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "Author deletes annotation"
ON public.project_annotations FOR DELETE TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_project_annotations_updated_at
BEFORE UPDATE ON public.project_annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.deliverable_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  deliverable_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment','download')),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliverable_shares_project ON public.deliverable_shares(project_id);
CREATE INDEX idx_deliverable_shares_token ON public.deliverable_shares(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_shares TO authenticated;
GRANT SELECT ON public.deliverable_shares TO anon;
GRANT ALL ON public.deliverable_shares TO service_role;

ALTER TABLE public.deliverable_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage shares select"
ON public.deliverable_shares FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners create shares"
ON public.deliverable_shares FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE POLICY "Owners update shares"
ON public.deliverable_shares FOR UPDATE TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete shares"
ON public.deliverable_shares FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_deliverable_shares_updated_at
BEFORE UPDATE ON public.deliverable_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_deliverable_share_by_token(_token TEXT)
RETURNS TABLE(
  id UUID,
  project_id UUID,
  deliverable_keys TEXT[],
  permission TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, project_id, deliverable_keys, permission, expires_at, revoked_at
  FROM public.deliverable_shares
  WHERE token = _token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;
