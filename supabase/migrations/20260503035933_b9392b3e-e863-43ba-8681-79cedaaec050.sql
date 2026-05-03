ALTER TABLE public.pilot_profiles
  ADD COLUMN IF NOT EXISTS software text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[];

DROP FUNCTION IF EXISTS public.get_public_pilots_v2(boolean);

CREATE OR REPLACE FUNCTION public.get_public_pilots_v2(_is_paid boolean DEFAULT false)
 RETURNS TABLE(
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
   software text[],
   languages text[],
   hourly_rate_cents integer,
   years_experience integer,
   part_107 boolean,
   insured boolean,
   portfolio_url text,
   avatar_url text,
   is_redacted boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    CASE WHEN _is_paid THEN p.display_name ELSE 'Verified Pilot' END,
    CASE WHEN _is_paid THEN p.bio ELSE NULL END,
    CASE WHEN _is_paid THEN p.service_area_label ELSE split_part(COALESCE(p.service_area_label,''), ',', -1) END,
    COALESCE(p.display_lat, p.service_lat),
    COALESCE(p.display_lng, p.service_lng),
    p.service_radius_km,
    p.verticals,
    CASE WHEN _is_paid THEN p.skills ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.equipment ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.software ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.languages ELSE ARRAY[]::text[] END,
    p.hourly_rate_cents,
    p.years_experience,
    p.part_107,
    p.insured,
    CASE WHEN _is_paid THEN p.portfolio_url ELSE NULL END,
    CASE WHEN _is_paid THEN pr.avatar_url ELSE NULL END,
    NOT _is_paid
  FROM public.pilot_profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.available = true
    AND p.show_on_map = true
    AND COALESCE(p.display_lat, p.service_lat) IS NOT NULL
    AND COALESCE(p.display_lng, p.service_lng) IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_pilot(_pilot_id uuid, _is_paid boolean DEFAULT false)
 RETURNS TABLE(
   pilot_id uuid,
   display_name text,
   bio text,
   service_area_label text,
   service_radius_km integer,
   verticals industry_vertical[],
   skills text[],
   equipment text[],
   software text[],
   languages text[],
   hourly_rate_cents integer,
   years_experience integer,
   part_107 boolean,
   insured boolean,
   portfolio_url text,
   avatar_url text,
   username text,
   portfolio_published boolean,
   contact_email text,
   phone text,
   verification_status pilot_verification_status,
   is_redacted boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    CASE WHEN _is_paid THEN p.display_name ELSE 'Verified Pilot' END,
    CASE WHEN _is_paid THEN p.bio ELSE NULL END,
    CASE WHEN _is_paid THEN p.service_area_label ELSE split_part(COALESCE(p.service_area_label,''), ',', -1) END,
    p.service_radius_km,
    p.verticals,
    CASE WHEN _is_paid THEN p.skills ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.equipment ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.software ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.languages ELSE ARRAY[]::text[] END,
    p.hourly_rate_cents,
    p.years_experience,
    p.part_107,
    p.insured,
    CASE WHEN _is_paid THEN p.portfolio_url ELSE NULL END,
    CASE WHEN _is_paid THEN pr.avatar_url ELSE NULL END,
    CASE WHEN _is_paid THEN pr.username ELSE NULL END,
    COALESCE(pr.portfolio_published, false),
    CASE WHEN _is_paid THEN p.contact_email ELSE NULL END,
    CASE WHEN _is_paid THEN p.phone ELSE NULL END,
    p.verification_status,
    NOT _is_paid
  FROM public.pilot_profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.user_id = _pilot_id
    AND p.available = true;
$function$;