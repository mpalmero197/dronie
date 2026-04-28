-- =========================================================
-- 1. Profile portfolio fields
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS portfolio_published boolean NOT NULL DEFAULT false;

-- Unique, case-insensitive username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uniq
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Reserved username blocklist (route names)
CREATE OR REPLACE FUNCTION public.is_reserved_username(_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(_name) = ANY (ARRAY[
    'auth','dashboard','admin','project','viewer','gallery','fleet','jobs',
    'install','privacy','terms','plan','missions','workflow','swarm','reality',
    'rtk','insights','compliance','splats','subscription','u','portfolio','api',
    'www','mail','app','assets','public','static','help','support','about',
    'login','logout','signup','signin','settings','billing','docs','blog','home'
  ]);
$$;

-- Validate format + reserved
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_chk CHECK (
    username IS NULL OR (
      length(username) BETWEEN 3 AND 30
      AND username ~ '^[a-zA-Z0-9_-]+$'
      AND NOT public.is_reserved_username(username)
    )
  );

-- Allow public to read portfolio-relevant profile fields
DROP POLICY IF EXISTS "Public can view published portfolio profiles" ON public.profiles;
CREATE POLICY "Public can view published portfolio profiles"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (username IS NOT NULL AND portfolio_published = true);

-- =========================================================
-- 2. Visibility enum
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.portfolio_visibility AS ENUM ('public','unlisted','private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 3. Albums
-- =========================================================
CREATE TABLE IF NOT EXISTS public.portfolio_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  cover_url text,
  visibility public.portfolio_visibility NOT NULL DEFAULT 'public',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_albums_slug_format_chk CHECK (
    length(slug) BETWEEN 1 AND 60 AND slug ~ '^[a-z0-9-]+$'
  ),
  CONSTRAINT portfolio_albums_user_slug_uniq UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS portfolio_albums_user_idx
  ON public.portfolio_albums (user_id, sort_order);

ALTER TABLE public.portfolio_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own albums" ON public.portfolio_albums;
CREATE POLICY "Owners manage own albums"
  ON public.portfolio_albums
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view public albums" ON public.portfolio_albums;
CREATE POLICY "Public can view public albums"
  ON public.portfolio_albums
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public');

-- Unlisted albums: readable by anyone who knows the id (used via .eq('id', ...))
DROP POLICY IF EXISTS "Anyone with link can view unlisted albums" ON public.portfolio_albums;
CREATE POLICY "Anyone with link can view unlisted albums"
  ON public.portfolio_albums
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'unlisted');

CREATE TRIGGER portfolio_albums_set_updated_at
  BEFORE UPDATE ON public.portfolio_albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Items (photos / videos / project links)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  album_id uuid REFERENCES public.portfolio_albums(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video','project_link')),
  storage_path text,
  media_url text,
  thumb_url text,
  title text,
  caption text,
  captured_at timestamptz,
  project_id uuid,
  width integer,
  height integer,
  duration_s integer,
  visibility public.portfolio_visibility NOT NULL DEFAULT 'public',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_items_user_idx
  ON public.portfolio_items (user_id, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_items_album_idx
  ON public.portfolio_items (album_id, sort_order);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own items" ON public.portfolio_items;
CREATE POLICY "Owners manage own items"
  ON public.portfolio_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view public items" ON public.portfolio_items;
CREATE POLICY "Public can view public items"
  ON public.portfolio_items
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public');

DROP POLICY IF EXISTS "Anyone with link can view unlisted items" ON public.portfolio_items;
CREATE POLICY "Anyone with link can view unlisted items"
  ON public.portfolio_items
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'unlisted');

CREATE TRIGGER portfolio_items_set_updated_at
  BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5. Public storage bucket for portfolio media
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-media', 'portfolio-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read
DROP POLICY IF EXISTS "Public read portfolio media" ON storage.objects;
CREATE POLICY "Public read portfolio media"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'portfolio-media');

-- Authenticated users may upload only into a folder named with their own user id
DROP POLICY IF EXISTS "Users upload own portfolio media" ON storage.objects;
CREATE POLICY "Users upload own portfolio media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own portfolio media" ON storage.objects;
CREATE POLICY "Users update own portfolio media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'portfolio-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own portfolio media" ON storage.objects;
CREATE POLICY "Users delete own portfolio media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portfolio-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );