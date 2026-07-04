DROP POLICY IF EXISTS "Auth insert edits" ON public.forum_post_edits;
CREATE POLICY "Auth insert own post edits"
ON public.forum_post_edits
FOR INSERT
TO authenticated
WITH CHECK (
  editor_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = forum_post_edits.post_id
        AND p.author_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

REVOKE EXECUTE ON FUNCTION public.forum_after_post_delete()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_after_post_insert()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_before_post_update()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_recount_score()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_org_member_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pilot_verification_status()     FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_forum_banned(uuid)                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid, uuid)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_request_thread(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;