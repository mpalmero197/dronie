
-- 1) Versions table
CREATE TABLE IF NOT EXISTS public.mission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  polygon jsonb NOT NULL,
  home_position jsonb,
  params jsonb NOT NULL,
  version_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_versions_plan_created
  ON public.mission_versions (plan_id, created_at DESC);

-- 2) Permissions for the Data API (auth-only)
GRANT SELECT, INSERT, DELETE ON public.mission_versions TO authenticated;
GRANT ALL ON public.mission_versions TO service_role;

-- 3) RLS
ALTER TABLE public.mission_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mission versions"
  ON public.mission_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own mission versions"
  ON public.mission_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own mission versions"
  ON public.mission_versions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 4) Trigger: snapshot the OLD row before each UPDATE of saved_flight_plans
CREATE OR REPLACE FUNCTION public.snapshot_mission_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _next int;
BEGIN
  -- Skip no-op updates of just updated_at
  IF OLD.polygon IS NOT DISTINCT FROM NEW.polygon
     AND OLD.params IS NOT DISTINCT FROM NEW.params
     AND OLD.home_position IS NOT DISTINCT FROM NEW.home_position
     AND OLD.name IS NOT DISTINCT FROM NEW.name THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO _next
  FROM public.mission_versions WHERE plan_id = OLD.id;

  INSERT INTO public.mission_versions
    (plan_id, user_id, name, polygon, home_position, params, version_number)
  VALUES
    (OLD.id, OLD.user_id, OLD.name, OLD.polygon, OLD.home_position, OLD.params, _next);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.snapshot_mission_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_snapshot_mission_version ON public.saved_flight_plans;
CREATE TRIGGER trg_snapshot_mission_version
BEFORE UPDATE ON public.saved_flight_plans
FOR EACH ROW EXECUTE FUNCTION public.snapshot_mission_version();

-- 5) Cascade-delete versions when the parent plan is deleted
CREATE OR REPLACE FUNCTION public.cleanup_mission_versions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.mission_versions WHERE plan_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_mission_versions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cleanup_mission_versions ON public.saved_flight_plans;
CREATE TRIGGER trg_cleanup_mission_versions
AFTER DELETE ON public.saved_flight_plans
FOR EACH ROW EXECUTE FUNCTION public.cleanup_mission_versions();
