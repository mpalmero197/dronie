
-- Drone status enum
CREATE TYPE public.drone_status AS ENUM ('idle', 'active', 'maintenance', 'offline');

-- Job status enum
CREATE TYPE public.job_status AS ENUM ('active', 'completed', 'aborted');

-- Drones table
CREATE TABLE public.drones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  status public.drone_status NOT NULL DEFAULT 'idle',
  battery_level INTEGER NOT NULL DEFAULT 100,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  flight_time_minutes INTEGER DEFAULT 0,
  stream_url TEXT,
  assigned_pilot_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drone_id UUID REFERENCES public.drones(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  pilot_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  status public.job_status NOT NULL DEFAULT 'active',
  mission_type TEXT NOT NULL DEFAULT 'survey',
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drones RLS: admins see all, pilots see assigned drones
CREATE POLICY "Admins manage all drones" ON public.drones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pilots view assigned drones" ON public.drones
  FOR SELECT TO authenticated
  USING (assigned_pilot_id = auth.uid());

-- Jobs RLS: admins see all, pilots see own jobs
CREATE POLICY "Admins manage all jobs" ON public.jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pilots view own jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (pilot_id = auth.uid());

CREATE POLICY "Pilots can update own jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (pilot_id = auth.uid())
  WITH CHECK (pilot_id = auth.uid());

-- Enable realtime for live telemetry
ALTER PUBLICATION supabase_realtime ADD TABLE public.drones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Updated_at triggers
CREATE TRIGGER set_drones_updated_at
  BEFORE UPDATE ON public.drones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
