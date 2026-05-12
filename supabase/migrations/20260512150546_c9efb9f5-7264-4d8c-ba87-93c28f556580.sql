DROP POLICY IF EXISTS "Authenticated users can read drone signals" ON public.drone_signals;

CREATE POLICY "Peers and assigned pilots read drone signals"
ON public.drone_signals
FOR SELECT
TO authenticated
USING (
  from_peer = (auth.uid())::text
  OR to_peer = (auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM public.drones d
    WHERE d.id = drone_signals.drone_id
      AND (d.assigned_pilot_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);