CREATE TABLE public.pilot_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  contact_email text,
  phone text,
  bio text,
  years_experience integer NOT NULL DEFAULT 0,
  hourly_rate_cents integer,
  service_area_label text,
  service_lat double precision,
  service_lng double precision,
  service_radius_km integer NOT NULL DEFAULT 50,
  verticals public.industry_vertical[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  part_107 boolean NOT NULL DEFAULT false,
  insured boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  portfolio_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots manage own profile"
  ON public.pilot_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can view available pilots"
  ON public.pilot_profiles FOR SELECT
  TO authenticated
  USING (available = true);

CREATE TRIGGER trg_pilot_profiles_updated_at
  BEFORE UPDATE ON public.pilot_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pilot_profiles_available ON public.pilot_profiles(available);
CREATE INDEX idx_pilot_profiles_verticals ON public.pilot_profiles USING GIN(verticals);

-- Haversine distance helper (km)
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$;

-- Find pilots matching a request: in service area + offers vertical
CREATE OR REPLACE FUNCTION public.find_matching_pilots(_request_id uuid)
RETURNS TABLE (
  pilot_id uuid,
  display_name text,
  service_area_label text,
  distance_km double precision,
  verticals public.industry_vertical[],
  hourly_rate_cents integer,
  years_experience integer,
  part_107 boolean,
  insured boolean,
  portfolio_url text
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.service_area_label,
    CASE
      WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL
        AND p.service_lat IS NOT NULL AND p.service_lng IS NOT NULL
      THEN public.haversine_km(r.latitude, r.longitude, p.service_lat, p.service_lng)
      ELSE NULL
    END AS distance_km,
    p.verticals,
    p.hourly_rate_cents,
    p.years_experience,
    p.part_107,
    p.insured,
    p.portfolio_url
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
  ORDER BY distance_km NULLS LAST, p.years_experience DESC
  LIMIT 50;
$$;