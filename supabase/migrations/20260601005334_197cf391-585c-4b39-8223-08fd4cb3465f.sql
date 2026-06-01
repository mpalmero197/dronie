-- Expand drones with enterprise-grade telemetry & state
ALTER TABLE public.drones
  ADD COLUMN IF NOT EXISTS gps_satellites smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_strength smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_quality smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wind_speed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wind_direction smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temperature_c numeric,
  ADD COLUMN IF NOT EXISTS payload_type text DEFAULT 'rgb',
  ADD COLUMN IF NOT EXISTS is_armed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS flight_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS home_latitude numeric,
  ADD COLUMN IF NOT EXISTS home_longitude numeric,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS max_altitude_m integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS rc_battery_level smallint DEFAULT 100,
  ADD COLUMN IF NOT EXISTS motor_count smallint DEFAULT 4,
  ADD COLUMN IF NOT EXISTS has_rtk boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_thermal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_lidar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_parachute boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_spotlight boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_speaker boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gimbal_pitch numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gimbal_yaw numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zoom_level numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recording boolean DEFAULT false;

-- Command queue table
CREATE TABLE IF NOT EXISTS public.drone_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  issued_by uuid NOT NULL,
  command text NOT NULL,
  params jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  response jsonb,
  error text,
  acked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drone_commands_drone ON public.drone_commands(drone_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drone_commands_status ON public.drone_commands(status) WHERE status = 'queued';

GRANT SELECT, INSERT, UPDATE ON public.drone_commands TO authenticated;
GRANT ALL ON public.drone_commands TO service_role;

ALTER TABLE public.drone_commands ENABLE ROW LEVEL SECURITY;

-- Owners (assigned pilot) and admins can view command history
CREATE POLICY "Owners and admins can view drone commands"
ON public.drone_commands FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.drones d
    WHERE d.id = drone_commands.drone_id
      AND (d.assigned_pilot_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Owners and admins can issue commands; issued_by must match auth.uid()
CREATE POLICY "Owners and admins can issue drone commands"
ON public.drone_commands FOR INSERT
TO authenticated
WITH CHECK (
  issued_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.drones d
    WHERE d.id = drone_commands.drone_id
      AND (d.assigned_pilot_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Bridge service can update command status (typically service_role, but
-- also allow the issuer to cancel their own queued commands)
CREATE POLICY "Issuer can cancel own queued commands"
ON public.drone_commands FOR UPDATE
TO authenticated
USING (
  issued_by = auth.uid() AND status = 'queued'
)
WITH CHECK (
  issued_by = auth.uid() AND status IN ('queued','cancelled')
);

-- Realtime publication so the console reflects ack updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.drone_commands;