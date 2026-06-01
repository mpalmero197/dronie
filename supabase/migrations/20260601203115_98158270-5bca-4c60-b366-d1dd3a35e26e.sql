
CREATE OR REPLACE FUNCTION public.get_share_payload(_token TEXT)
RETURNS TABLE(
  share_id UUID,
  project_id UUID,
  project_name TEXT,
  owner_username TEXT,
  permission TEXT,
  deliverable_keys TEXT[],
  outputs_urls JSONB,
  outputs TEXT[],
  expires_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT *
    FROM public.deliverable_shares
    WHERE token = _token
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  ), filtered AS (
    SELECT s.*, p.name AS pname, p.outputs AS pouts, p.outputs_urls AS purls
    FROM s
    JOIN public.projects p ON p.id = s.project_id
  )
  SELECT
    f.id,
    f.project_id,
    f.pname,
    pr.username,
    f.permission,
    f.deliverable_keys,
    (
      SELECT jsonb_object_agg(kv.key, kv.value)
      FROM jsonb_each(COALESCE(f.purls, '{}'::jsonb)) AS kv
      WHERE kv.key = ANY(f.deliverable_keys)
    ),
    f.pouts,
    f.expires_at
  FROM filtered f
  LEFT JOIN public.profiles pr ON pr.id = f.owner_id;
$$;

CREATE OR REPLACE FUNCTION public.bump_share_view(_token TEXT)
RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.deliverable_shares
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE token = _token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_share_payload(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_share_view(TEXT) TO anon, authenticated;
