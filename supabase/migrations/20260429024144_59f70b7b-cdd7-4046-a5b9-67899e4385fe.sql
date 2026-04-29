ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer,
  ADD COLUMN IF NOT EXISTS available_for_hire boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;