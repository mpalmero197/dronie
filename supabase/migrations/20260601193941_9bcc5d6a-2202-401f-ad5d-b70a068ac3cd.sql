CREATE TABLE public.mission_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.saved_flight_plans(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  weather_status TEXT NOT NULL DEFAULT 'unknown',
  weather_summary TEXT,
  weather_checked_at TIMESTAMPTZ,
  max_wind_kph NUMERIC NOT NULL DEFAULT 30,
  max_precip_pct INTEGER NOT NULL DEFAULT 30,
  min_visibility_km NUMERIC NOT NULL DEFAULT 5,
  min_temp_c NUMERIC NOT NULL DEFAULT -10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_schedules TO authenticated;
GRANT ALL ON public.mission_schedules TO service_role;

ALTER TABLE public.mission_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mission schedules"
  ON public.mission_schedules
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mission_schedules_user_time
  ON public.mission_schedules (user_id, scheduled_at);

CREATE TRIGGER update_mission_schedules_updated_at
  BEFORE UPDATE ON public.mission_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();