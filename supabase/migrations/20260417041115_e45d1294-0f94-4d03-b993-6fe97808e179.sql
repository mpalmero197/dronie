-- Add stream_mode and demo path to drones
ALTER TABLE public.drones
  ADD COLUMN IF NOT EXISTS stream_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stream_demo_path TEXT;

-- Constrain stream_mode values
DO $$ BEGIN
  ALTER TABLE public.drones
    ADD CONSTRAINT drones_stream_mode_check
    CHECK (stream_mode IN ('none', 'webrtc', 'url', 'upload'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Signaling table for WebRTC offer/answer/ICE
CREATE TABLE IF NOT EXISTS public.drone_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drone_id UUID NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  from_peer TEXT NOT NULL,
  to_peer TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('offer', 'answer', 'ice', 'bye', 'hello')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drone_signals_drone_id ON public.drone_signals(drone_id, created_at DESC);

ALTER TABLE public.drone_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drone signals"
  ON public.drone_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert drone signals"
  ON public.drone_signals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete own drone signals"
  ON public.drone_signals FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.drone_signals;
ALTER TABLE public.drone_signals REPLICA IDENTITY FULL;

-- Storage bucket for demo clips
INSERT INTO storage.buckets (id, name, public)
VALUES ('drone-demos', 'drone-demos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read drone demos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'drone-demos');

CREATE POLICY "Admins can upload drone demos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'drone-demos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete drone demos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'drone-demos' AND public.has_role(auth.uid(), 'admin'));
