
-- =========================================================
-- 1. PILOT PRIVACY
-- =========================================================
ALTER TABLE public.pilot_profiles
  ADD COLUMN IF NOT EXISTS show_on_map boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_privacy boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_lat double precision,
  ADD COLUMN IF NOT EXISTS display_lng double precision,
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz;

-- Public-safe pilot directory function (returns jittered coords only)
CREATE OR REPLACE FUNCTION public.get_public_pilots()
RETURNS TABLE (
  pilot_id uuid,
  display_name text,
  bio text,
  service_area_label text,
  display_lat double precision,
  display_lng double precision,
  service_radius_km integer,
  verticals industry_vertical[],
  skills text[],
  equipment text[],
  hourly_rate_cents integer,
  years_experience integer,
  part_107 boolean,
  insured boolean,
  portfolio_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.bio,
    p.service_area_label,
    COALESCE(p.display_lat, p.service_lat) AS display_lat,
    COALESCE(p.display_lng, p.service_lng) AS display_lng,
    p.service_radius_km,
    p.verticals,
    p.skills,
    p.equipment,
    p.hourly_rate_cents,
    p.years_experience,
    p.part_107,
    p.insured,
    p.portfolio_url
  FROM public.pilot_profiles p
  WHERE p.available = true
    AND p.show_on_map = true
    AND COALESCE(p.display_lat, p.service_lat) IS NOT NULL
    AND COALESCE(p.display_lng, p.service_lng) IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_pilots() TO anon, authenticated;

-- =========================================================
-- 2. CERTIFICATIONS — recert tracking
-- =========================================================
ALTER TABLE public.pilot_certifications
  ADD COLUMN IF NOT EXISTS recert_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recert_confirmed_at timestamptz;

-- =========================================================
-- 3. ORGANIZATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  website text,
  contact_email text,
  phone text,
  bio text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  invited_email text,
  role text NOT NULL DEFAULT 'pilot' CHECK (role IN ('owner','manager','pilot')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_uniq
  ON public.organization_members(org_id, user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Helper function to check membership/management without recursion
CREATE OR REPLACE FUNCTION public.is_org_manager(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id
      AND m.user_id = _user_id
      AND m.status = 'active'
      AND m.role IN ('owner','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

-- RLS policies: organizations
CREATE POLICY "Owners and managers manage their org"
  ON public.organizations FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_org_manager(id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members can view their org"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Public can view verified orgs"
  ON public.organizations FOR SELECT TO anon, authenticated
  USING (verified = true);

-- RLS policies: organization_members
CREATE POLICY "Org managers manage members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.is_org_manager(org_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_manager(org_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members can view their org roster"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Invited user can update own membership"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies: organization_invites
CREATE POLICY "Org managers manage invites"
  ON public.organization_invites FOR ALL TO authenticated
  USING (public.is_org_manager(org_id, auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_org_manager(org_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Allow signed-in users to read invite by token (handled in code via token match)
CREATE POLICY "Authenticated can read invites"
  ON public.organization_invites FOR SELECT TO authenticated
  USING (true);

-- Org managers can view their members' certifications
CREATE POLICY "Org managers view member certifications"
  ON public.pilot_certifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = pilot_certifications.user_id
      AND m.status = 'active'
      AND public.is_org_manager(m.org_id, auth.uid())
  ));

-- Org managers can view their members' pilot profile
CREATE POLICY "Org managers view member pilot profiles"
  ON public.pilot_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = pilot_profiles.user_id
      AND m.status = 'active'
      AND public.is_org_manager(m.org_id, auth.uid())
  ));

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. UPDATE find_matching_pilots to exclude expired certs
-- =========================================================
CREATE OR REPLACE FUNCTION public.find_matching_pilots(_request_id uuid)
RETURNS TABLE(
  pilot_id uuid, display_name text, service_area_label text,
  distance_km double precision, verticals industry_vertical[],
  hourly_rate_cents integer, years_experience integer,
  part_107 boolean, insured boolean, portfolio_url text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.user_id, p.display_name, p.service_area_label,
    CASE
      WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL
        AND p.service_lat IS NOT NULL AND p.service_lng IS NOT NULL
      THEN public.haversine_km(r.latitude, r.longitude, p.service_lat, p.service_lng)
      ELSE NULL
    END AS distance_km,
    p.verticals, p.hourly_rate_cents, p.years_experience,
    p.part_107, p.insured, p.portfolio_url
  FROM public.service_requests r
  CROSS JOIN public.pilot_profiles p
  WHERE r.id = _request_id
    AND p.available = true
    AND (r.vertical = ANY(p.verticals) OR cardinality(p.verticals) = 0)
    AND (
      r.latitude IS NULL OR r.longitude IS NULL
      OR p.service_lat IS NULL OR p.service_lng IS NULL
      OR public.haversine_km(r.latitude, r.longitude, p.service_lat, p.service_lng) <= p.service_radius_km
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pilot_certifications c
      WHERE c.user_id = p.user_id
        AND c.expires_at < CURRENT_DATE
        AND c.recert_confirmed_at IS NULL
    )
  ORDER BY distance_km NULLS LAST, p.years_experience DESC
  LIMIT 50;
$$;

-- Backfill display_lat/lng with raw coords (will be jittered on next save)
UPDATE public.pilot_profiles
SET display_lat = service_lat, display_lng = service_lng
WHERE display_lat IS NULL AND service_lat IS NOT NULL;
