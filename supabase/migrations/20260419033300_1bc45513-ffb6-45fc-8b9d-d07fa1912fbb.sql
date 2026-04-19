-- Mission logs: structured timeline of events during a flight
CREATE TABLE public.mission_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  pilot_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mission_logs_job_id ON public.mission_logs(job_id);
CREATE INDEX idx_mission_logs_recorded_at ON public.mission_logs(recorded_at DESC);

ALTER TABLE public.mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots manage own mission logs"
  ON public.mission_logs
  FOR ALL
  TO authenticated
  USING (pilot_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (pilot_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Realtime so office viewers see events live
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_logs;

-- Pilot tracks: continuous GPS breadcrumbs from the pilot's phone during a mission
CREATE TABLE public.pilot_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  pilot_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pilot_tracks_job_id ON public.pilot_tracks(job_id);
CREATE INDEX idx_pilot_tracks_recorded_at ON public.pilot_tracks(recorded_at DESC);

ALTER TABLE public.pilot_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots manage own tracks"
  ON public.pilot_tracks
  FOR ALL
  TO authenticated
  USING (pilot_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (pilot_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.pilot_tracks;