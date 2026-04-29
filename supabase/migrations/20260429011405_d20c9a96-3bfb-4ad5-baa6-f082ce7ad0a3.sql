-- splat_jobs ----------------------------------------------------------------
CREATE TABLE public.splat_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  preset TEXT NOT NULL DEFAULT 'balanced',
  iterations INTEGER NOT NULL DEFAULT 30000,
  sph_degree INTEGER NOT NULL DEFAULT 2,
  use_georef BOOLEAN NOT NULL DEFAULT true,
  image_count INTEGER,
  psnr NUMERIC(5,2),
  training_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  output_path TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_splat_jobs_project_created
  ON public.splat_jobs (project_id, created_at DESC);

ALTER TABLE public.splat_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "splat_jobs_owner_select" ON public.splat_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "splat_jobs_owner_insert" ON public.splat_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "splat_jobs_owner_update" ON public.splat_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "splat_jobs_owner_delete" ON public.splat_jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER splat_jobs_updated_at
  BEFORE UPDATE ON public.splat_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- splat_shares ---------------------------------------------------------------
CREATE TABLE public.splat_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  asset_path TEXT NOT NULL,
  asset_name TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_splat_shares_token ON public.splat_shares (token);

ALTER TABLE public.splat_shares ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "splat_shares_owner_all" ON public.splat_shares
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public read by token, only if not expired
CREATE POLICY "splat_shares_public_token_read" ON public.splat_shares
  FOR SELECT
  TO anon, authenticated
  USING (expires_at IS NULL OR expires_at > now());
