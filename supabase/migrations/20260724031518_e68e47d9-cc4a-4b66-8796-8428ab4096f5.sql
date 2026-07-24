
ALTER TABLE public.splat_jobs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'photos'
    CHECK (source IN ('photos','video')),
  ADD COLUMN IF NOT EXISTS frame_prefix text;
