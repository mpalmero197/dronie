-- ============ ENUMS ============
CREATE TYPE public.adsp_service_kind AS ENUM (
  'strategic_deconfliction',
  'conformance_monitoring',
  'terrain_obstacle',
  'aeronautical_data',
  'weather',
  'flight_planning_support'
);

CREATE TYPE public.adsp_service_status AS ENUM ('operational', 'degraded', 'maintenance', 'offline');

CREATE TYPE public.adsp_incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.flight_intent_status AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- ============ SERVICES ============
CREATE TABLE public.adsp_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.adsp_service_kind NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  source text NOT NULL DEFAULT 'internal',
  data_sources text[] NOT NULL DEFAULT '{}',
  performance_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  limitations text[] NOT NULL DEFAULT '{}',
  update_frequency text,
  coverage text,
  status public.adsp_service_status NOT NULL DEFAULT 'operational',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adsp_services TO authenticated;
GRANT ALL ON public.adsp_services TO service_role;
ALTER TABLE public.adsp_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services readable by authenticated" ON public.adsp_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage services" ON public.adsp_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER adsp_services_updated_at BEFORE UPDATE ON public.adsp_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.adsp_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.adsp_services(id) ON DELETE CASCADE,
  drone_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  accepted_limitations_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id, drone_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsp_subscriptions TO authenticated;
GRANT ALL ON public.adsp_subscriptions TO service_role;
ALTER TABLE public.adsp_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own subscriptions" ON public.adsp_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER adsp_subscriptions_updated_at BEFORE UPDATE ON public.adsp_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SERVICE RECORDS (evidence trail) ============
CREATE TABLE public.adsp_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_kind public.adsp_service_kind NOT NULL,
  plan_id uuid,
  job_id uuid,
  project_id uuid,
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_source text,
  data_currency timestamptz,
  latency_ms integer,
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adsp_service_records TO authenticated;
GRANT ALL ON public.adsp_service_records TO service_role;
ALTER TABLE public.adsp_service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own service records" ON public.adsp_service_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_adsp_records_user_created ON public.adsp_service_records(user_id, created_at DESC);

-- ============ FLIGHT INTENTS ============
CREATE TABLE public.flight_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid,
  project_id uuid,
  job_id uuid,
  name text NOT NULL,
  polygon jsonb NOT NULL,
  min_lat double precision NOT NULL,
  min_lng double precision NOT NULL,
  max_lat double precision NOT NULL,
  max_lng double precision NOT NULL,
  min_alt_agl_m numeric NOT NULL DEFAULT 0,
  max_alt_agl_m numeric NOT NULL DEFAULT 121.92,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status public.flight_intent_status NOT NULL DEFAULT 'planned',
  shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flight_intents TO authenticated;
GRANT ALL ON public.flight_intents TO service_role;
ALTER TABLE public.flight_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own flight intents" ON public.flight_intents
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Shared intents readable" ON public.flight_intents
  FOR SELECT TO authenticated
  USING (shared = true AND status IN ('planned','active'));
CREATE INDEX idx_flight_intents_window ON public.flight_intents(start_time, end_time);
CREATE TRIGGER flight_intents_updated_at BEFORE UPDATE ON public.flight_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DECONFLICTION CHECKS ============
CREATE TABLE public.deconfliction_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intent_id uuid REFERENCES public.flight_intents(id) ON DELETE SET NULL,
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  clear boolean NOT NULL DEFAULT true,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deconfliction_checks TO authenticated;
GRANT ALL ON public.deconfliction_checks TO service_role;
ALTER TABLE public.deconfliction_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own deconfliction checks" ON public.deconfliction_checks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ CONFORMANCE EVENTS ============
CREATE TABLE public.conformance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intent_id uuid REFERENCES public.flight_intents(id) ON DELETE CASCADE,
  job_id uuid,
  deviation_type text NOT NULL,
  magnitude numeric,
  unit text,
  latitude double precision,
  longitude double precision,
  altitude_m numeric,
  detail text,
  resolved boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.conformance_events TO authenticated;
GRANT ALL ON public.conformance_events TO service_role;
ALTER TABLE public.conformance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own conformance events" ON public.conformance_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own conformance events update" ON public.conformance_events
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_conformance_intent ON public.conformance_events(intent_id, recorded_at DESC);

-- ============ INCIDENTS ============
CREATE TABLE public.adsp_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid,
  service_kind public.adsp_service_kind,
  severity public.adsp_incident_severity NOT NULL DEFAULT 'low',
  title text NOT NULL,
  description text NOT NULL,
  affected_users integer NOT NULL DEFAULT 0,
  root_cause text,
  corrective_action text,
  faa_notified boolean NOT NULL DEFAULT false,
  users_notified boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsp_incidents TO authenticated;
GRANT ALL ON public.adsp_incidents TO service_role;
ALTER TABLE public.adsp_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage incidents" ON public.adsp_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users report incidents" ON public.adsp_incidents
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Reporters read own incidents" ON public.adsp_incidents
  FOR SELECT TO authenticated
  USING (reported_by = auth.uid());
CREATE TRIGGER adsp_incidents_updated_at BEFORE UPDATE ON public.adsp_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QMS DOCUMENTS ============
CREATE TABLE public.adsp_qms_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'procedure',
  reference text,
  summary text,
  owner_name text,
  document_url text,
  version text NOT NULL DEFAULT '1.0',
  effective_date date,
  review_due date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsp_qms_documents TO authenticated;
GRANT ALL ON public.adsp_qms_documents TO service_role;
ALTER TABLE public.adsp_qms_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage qms docs" ON public.adsp_qms_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER adsp_qms_documents_updated_at BEFORE UPDATE ON public.adsp_qms_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PERSONNEL ============
CREATE TABLE public.adsp_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  full_name text NOT NULL,
  role_title text NOT NULL,
  responsibilities text,
  training_completed text[] NOT NULL DEFAULT '{}',
  competency_verified_at date,
  next_review date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsp_personnel TO authenticated;
GRANT ALL ON public.adsp_personnel TO service_role;
ALTER TABLE public.adsp_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage personnel" ON public.adsp_personnel
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER adsp_personnel_updated_at BEFORE UPDATE ON public.adsp_personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PERFORMANCE SAMPLES ============
CREATE TABLE public.adsp_performance_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_kind public.adsp_service_kind NOT NULL,
  available boolean NOT NULL DEFAULT true,
  latency_ms integer,
  error_rate numeric NOT NULL DEFAULT 0,
  data_currency_minutes integer,
  sampled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adsp_performance_samples TO authenticated;
GRANT ALL ON public.adsp_performance_samples TO service_role;
ALTER TABLE public.adsp_performance_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Performance readable by authenticated" ON public.adsp_performance_samples
  FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_adsp_perf_kind_time ON public.adsp_performance_samples(service_kind, sampled_at DESC);

-- ============ SEED SERVICES ============
INSERT INTO public.adsp_services (kind, name, description, source, data_sources, performance_criteria, limitations, update_frequency, coverage) VALUES
('strategic_deconfliction', 'Strategic Deconfliction',
 'Pre-flight check of a proposed operating volume against all shared flight intents to identify overlapping operations in space and time.',
 'internal', ARRAY['Dronie flight intent registry'],
 '{"availability_pct":99.5,"max_latency_ms":2000,"update_frequency":"real-time"}'::jsonb,
 ARRAY['Only covers operations published to Dronie','Does not include manned aircraft traffic','Advisory only — does not grant airspace authorization'],
 'Real-time', 'Global (Dronie operations)'),
('conformance_monitoring', 'Conformance Monitoring',
 'Continuous comparison of live telemetry against the planned operating volume, raising alerts on lateral, vertical, or time deviations.',
 'internal', ARRAY['Dronie telemetry stream'],
 '{"availability_pct":99.0,"max_latency_ms":5000,"sample_interval_s":5}'::jsonb,
 ARRAY['Requires active telemetry link','Accuracy limited by aircraft GPS accuracy','Not a replacement for the remote pilot in command'],
 'Every 5 seconds', 'Global (Dronie operations)'),
('terrain_obstacle', 'Terrain & Obstacle Data',
 'Elevation and obstruction lookups for the operating area, producing a minimum safe altitude advisory.',
 'external', ARRAY['USGS 3DEP elevation','FAA Digital Obstacle File'],
 '{"availability_pct":99.0,"max_latency_ms":8000,"vertical_accuracy_m":3}'::jsonb,
 ARRAY['Obstacle data reflects last published FAA cycle','Temporary obstructions (cranes, towers) may be missing','Coverage best over the United States'],
 '56-day FAA cycle', 'United States'),
('aeronautical_data', 'Aeronautical Data',
 'Airspace classification, temporary flight restrictions, and NOTAM information for the operating area.',
 'external', ARRAY['FAA UAS Facility Maps','FAA TFR feed','FAA NOTAM service'],
 '{"availability_pct":99.0,"max_latency_ms":8000}'::jsonb,
 ARRAY['Not a substitute for an official preflight briefing','TFR data may lag the official source','Does not provide LAANC authorization'],
 'Hourly', 'United States'),
('weather', 'Weather Data',
 'Current conditions and short-range forecast for the operating area with a go/no-go summary against configured limits.',
 'external', ARRAY['NOAA/NWS forecast API','Open-Meteo'],
 '{"availability_pct":99.0,"max_latency_ms":6000}'::jsonb,
 ARRAY['Forecast resolution may not capture local microclimates','Wind values are surface estimates, not at altitude','Advisory only'],
 'Hourly', 'Global'),
('flight_planning_support', 'Flight Planning Support',
 'Automated mission geometry, altitude, overlap and battery planning checks that feed the flight planner and pre-flight checklist.',
 'internal', ARRAY['Dronie mission planning engine'],
 '{"availability_pct":99.9,"max_latency_ms":1000}'::jsonb,
 ARRAY['Estimates assume nominal aircraft performance','Does not account for unpublished local restrictions'],
 'Real-time', 'Global');