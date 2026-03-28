-- Add outputs_urls JSONB column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS outputs_urls jsonb DEFAULT '{}'::jsonb;

-- Create project-outputs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-outputs', 'project-outputs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can read their own project outputs
CREATE POLICY "Users can read own project outputs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-outputs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: public can read project outputs (bucket is public)
CREATE POLICY "Public can read project outputs"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'project-outputs');