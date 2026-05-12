
-- 1. drone_signals: scope DELETE to signal owner / drone owner / admin
DROP POLICY IF EXISTS "Authenticated users can delete own drone signals" ON public.drone_signals;
CREATE POLICY "Users delete own drone signals"
  ON public.drone_signals FOR DELETE TO authenticated
  USING (
    from_peer = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.drones d
      WHERE d.id = drone_signals.drone_id
        AND (d.assigned_pilot_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- 2. flight_plans: symmetric admin permissions
DROP POLICY IF EXISTS "Users can manage own flight plans" ON public.flight_plans;
CREATE POLICY "Users can manage own flight plans"
  ON public.flight_plans
  FOR ALL
  TO public
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. organization_invites: restrict SELECT
DROP POLICY IF EXISTS "Authenticated can read invites" ON public.organization_invites;
CREATE POLICY "Managers, admins, or invitee can read invites"
  ON public.organization_invites FOR SELECT TO authenticated
  USING (
    public.is_org_manager(org_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
  );

-- 4. splat_shares: remove enumerable public read; add token lookup RPC
DROP POLICY IF EXISTS splat_shares_public_token_read ON public.splat_shares;

CREATE OR REPLACE FUNCTION public.get_splat_share_by_token(_token text)
RETURNS TABLE(asset_path text, asset_name text, expires_at timestamptz, project_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.asset_path, s.asset_name, s.expires_at, s.project_id
  FROM public.splat_shares s
  WHERE s.token = _token
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_splat_share_by_token(text) TO anon, authenticated;

-- 5. Remove pilot_verifications from realtime publication (sensitive identity data)
ALTER PUBLICATION supabase_realtime DROP TABLE public.pilot_verifications;

-- 6. pilot_profiles: hide contact_email/phone from broad reads via column grants;
--    add owner self-read RPC so the owner can still load their own full profile.
REVOKE SELECT (contact_email, phone) ON public.pilot_profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_pilot_profile()
RETURNS SETOF public.pilot_profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pilot_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_pilot_profile() TO authenticated;

-- 7. Fix mutable search_path on is_reserved_username
CREATE OR REPLACE FUNCTION public.is_reserved_username(_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(_name) = ANY (ARRAY[
    'auth','dashboard','admin','project','viewer','gallery','fleet','jobs',
    'install','privacy','terms','plan','missions','workflow','swarm','reality',
    'rtk','insights','compliance','splats','subscription','u','portfolio','api',
    'www','mail','app','assets','public','static','help','support','about',
    'login','logout','signup','signin','settings','billing','docs','blog','home'
  ]);
$$;
