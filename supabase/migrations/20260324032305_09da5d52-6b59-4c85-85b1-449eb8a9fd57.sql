-- Create flight_plans table for KMZ/KML files
CREATE TABLE public.flight_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT 'kml',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flight plans"
  ON public.flight_plans FOR ALL
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for flight plans
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flight-plans',
  'flight-plans',
  false,
  52428800,
  ARRAY['application/vnd.google-earth.kml+xml', 'application/vnd.google-earth.kmz', 'application/xml', 'text/xml', 'application/zip', 'application/octet-stream']
) ON CONFLICT DO NOTHING;

-- RLS for flight-plans bucket
CREATE POLICY "Authenticated users can upload flight plans"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'flight-plans' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own flight plans"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'flight-plans' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own flight plans"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'flight-plans' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Update drone-images bucket with proper size limit
UPDATE storage.buckets 
SET file_size_limit = 104857600
WHERE id = 'drone-images';

-- RLS for drone-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload drone images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated users can upload drone images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'drone-images' AND (storage.foldername(name))[1] = auth.uid()::text)
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can view own drone images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own drone images"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'drone-images' AND (storage.foldername(name))[1] = auth.uid()::text)
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can delete own drone images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own drone images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'drone-images' AND (storage.foldername(name))[1] = auth.uid()::text)
    $policy$;
  END IF;
END $$;