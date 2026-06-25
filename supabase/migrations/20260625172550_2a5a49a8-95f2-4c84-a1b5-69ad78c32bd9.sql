
-- 1) ORGANIZATIONS: remove anonymous/authenticated access to verified org rows (which included contact_email/phone)
DROP POLICY IF EXISTS "Public can view verified orgs" ON public.organizations;

-- 2) PROFILES: restrict the published portfolio policy to authenticated users; provide an RPC for anonymous safe reads
DROP POLICY IF EXISTS "Public can view published portfolio profiles" ON public.profiles;

CREATE POLICY "Authenticated can view published portfolios"
ON public.profiles
FOR SELECT
TO authenticated
USING (username IS NOT NULL AND portfolio_published = true);

CREATE OR REPLACE FUNCTION public.get_public_portfolio(_username text)
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  headline text,
  bio text,
  location text,
  website text,
  instagram text,
  linkedin text,
  twitter text,
  youtube text,
  vimeo text,
  tiktok text,
  contact_email text,
  phone text,
  resume_url text,
  portfolio_published boolean,
  banner_url text,
  theme text,
  services text[],
  hourly_rate_cents integer,
  available_for_hire boolean,
  visibility_prefs jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.headline,
    p.bio,
    p.location,
    p.website,
    p.instagram,
    p.linkedin,
    p.twitter,
    p.youtube,
    p.vimeo,
    p.tiktok,
    CASE
      WHEN COALESCE((p.visibility_prefs->>'contact_email')::boolean, false) THEN p.contact_email
      ELSE NULL
    END AS contact_email,
    CASE
      WHEN COALESCE((p.visibility_prefs->>'phone')::boolean, false) THEN p.phone
      ELSE NULL
    END AS phone,
    p.resume_url,
    p.portfolio_published,
    p.banner_url,
    p.theme,
    p.services,
    p.hourly_rate_cents,
    p.available_for_hire,
    COALESCE(p.visibility_prefs, '{}'::jsonb) AS visibility_prefs
  FROM public.profiles p
  WHERE lower(p.username) = lower(_username)
    AND p.portfolio_published = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_portfolio(text) TO anon, authenticated;

-- 3) PILOT_PROFILES: revoke column-level read access to sensitive fields from anon/authenticated.
-- Owners (and admins/org managers) read these via SECURITY DEFINER functions like get_my_pilot_profile().
REVOKE SELECT (
  service_lat,
  service_lng,
  verification_status,
  verification_rejection_reason,
  accepted_terms_at,
  location_privacy,
  hourly_rate_cents,
  contact_email,
  phone
) ON public.pilot_profiles FROM anon, authenticated;

-- 4) REALTIME: only allow authenticated users to subscribe to topics scoped to their own user id.
-- Topic convention used by the app: notifications, drone commands, request threads, and pilot tracks
-- should be published on channels whose topic contains the user's auth.uid().
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to their own realtime topics" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('%' || auth.uid()::text || '%')
);

DROP POLICY IF EXISTS "Users can broadcast on their own realtime topics" ON realtime.messages;
CREATE POLICY "Users can broadcast on their own realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('%' || auth.uid()::text || '%')
);
