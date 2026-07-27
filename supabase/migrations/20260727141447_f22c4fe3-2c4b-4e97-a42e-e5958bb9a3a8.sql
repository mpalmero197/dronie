ALTER TABLE public.splat_jobs
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_prediction_id text,
  ADD COLUMN IF NOT EXISTS provider_output_url text;

CREATE INDEX IF NOT EXISTS idx_splat_jobs_provider_prediction
  ON public.splat_jobs (provider_prediction_id)
  WHERE provider_prediction_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.splat_jobs TO authenticated;
GRANT ALL ON public.splat_jobs TO service_role;