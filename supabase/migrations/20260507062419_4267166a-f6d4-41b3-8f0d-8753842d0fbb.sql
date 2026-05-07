
CREATE INDEX IF NOT EXISTS idx_pilot_profiles_map_lookup
  ON public.pilot_profiles (available, show_on_map)
  WHERE available = true AND show_on_map = true;

CREATE INDEX IF NOT EXISTS idx_pilot_profiles_display_coords
  ON public.pilot_profiles (display_lat, display_lng)
  WHERE display_lat IS NOT NULL AND display_lng IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_public_pilots_lite(boolean, integer, integer, industry_vertical, double precision, double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION public.get_public_pilots_lite(
  _is_paid boolean DEFAULT false,
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0,
  _vertical industry_vertical DEFAULT NULL,
  _min_lat double precision DEFAULT NULL,
  _min_lng double precision DEFAULT NULL,
  _max_lat double precision DEFAULT NULL,
  _max_lng double precision DEFAULT NULL
)
RETURNS TABLE(
  pilot_id uuid,
  display_name text,
  service_area_label text,
  display_lat double precision,
  display_lng double precision,
  service_radius_km integer,
  verticals industry_vertical[],
  hourly_rate_cents integer,
  years_experience integer,
  part_107 boolean,
  insured boolean,
  avatar_url text,
  is_redacted boolean,
  total_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      p.user_id,
      p.display_name,
      p.service_area_label,
      COALESCE(p.display_lat, p.service_lat) AS lat,
      COALESCE(p.display_lng, p.service_lng) AS lng,
      p.service_radius_km,
      p.verticals,
      p.hourly_rate_cents,
      p.years_experience,
      p.part_107,
      p.insured,
      pr.avatar_url
    FROM public.pilot_profiles p
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE p.available = true
      AND p.show_on_map = true
      AND COALESCE(p.display_lat, p.service_lat) IS NOT NULL
      AND COALESCE(p.display_lng, p.service_lng) IS NOT NULL
      AND (_vertical IS NULL OR _vertical = ANY(p.verticals))
      AND (_min_lat IS NULL OR COALESCE(p.display_lat, p.service_lat) BETWEEN _min_lat AND _max_lat)
      AND (_min_lng IS NULL OR COALESCE(p.display_lng, p.service_lng) BETWEEN _min_lng AND _max_lng)
  ), counted AS (
    SELECT *, count(*) OVER () AS total_count FROM base
  )
  SELECT
    user_id,
    CASE WHEN _is_paid THEN display_name ELSE 'Verified Pilot' END,
    CASE WHEN _is_paid THEN service_area_label ELSE split_part(COALESCE(service_area_label,''), ',', -1) END,
    lat,
    lng,
    service_radius_km,
    verticals,
    hourly_rate_cents,
    years_experience,
    part_107,
    insured,
    CASE WHEN _is_paid THEN avatar_url ELSE NULL END,
    NOT _is_paid,
    total_count
  FROM counted
  ORDER BY years_experience DESC NULLS LAST, user_id
  LIMIT GREATEST(LEAST(_limit, 500), 1)
  OFFSET GREATEST(_offset, 0);
$function$;
