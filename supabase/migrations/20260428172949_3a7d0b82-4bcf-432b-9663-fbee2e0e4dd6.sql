DROP FUNCTION IF EXISTS public.get_public_pilots();

CREATE OR REPLACE FUNCTION public.get_public_pilots()
 RETURNS TABLE(pilot_id uuid, display_name text, bio text, service_area_label text, display_lat double precision, display_lng double precision, service_radius_km integer, verticals industry_vertical[], skills text[], equipment text[], hourly_rate_cents integer, years_experience integer, part_107 boolean, insured boolean, portfolio_url text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.portfolio_url,
    pr.avatar_url
  FROM public.pilot_profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.available = true
    AND p.show_on_map = true
    AND COALESCE(p.display_lat, p.service_lat) IS NOT NULL
    AND COALESCE(p.display_lng, p.service_lng) IS NOT NULL;
$function$;