
DROP POLICY IF EXISTS "Invited user can update own membership" ON public.organization_members;

CREATE POLICY "Invited user can accept own membership"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.prevent_org_member_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_org_manager(NEW.org_id, auth.uid())
     OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT DISTINCT FROM auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'Cannot change organization';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot change membership user';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'invited' AND NEW.status = 'active')
         OR (NEW.status = 'removed')
       ) THEN
      RAISE EXCEPTION 'Invalid membership status transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_org_member_self_escalation ON public.organization_members;
CREATE TRIGGER trg_prevent_org_member_self_escalation
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_org_member_self_escalation();

DROP POLICY IF EXISTS "Authenticated users can insert drone signals" ON public.drone_signals;

CREATE POLICY "Authorized peers can insert drone signals"
ON public.drone_signals
FOR INSERT
TO authenticated
WITH CHECK (
  from_peer = (auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.drones d
      WHERE d.id = drone_signals.drone_id
        AND d.assigned_pilot_id = auth.uid()
    )
  )
);

ALTER PUBLICATION supabase_realtime DROP TABLE public.pilot_profiles;
