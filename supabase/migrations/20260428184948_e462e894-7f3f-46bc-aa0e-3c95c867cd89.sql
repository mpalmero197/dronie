
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS processing_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_stage text,
  ADD COLUMN IF NOT EXISTS stage_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_seconds integer,
  ADD COLUMN IF NOT EXISTS stage_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS webodm_task_id text,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS accuracy_report jsonb;

ALTER TABLE public.projects REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projects';
  END IF;
END $$;
