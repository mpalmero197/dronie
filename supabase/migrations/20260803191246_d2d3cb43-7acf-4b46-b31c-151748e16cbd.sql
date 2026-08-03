-- 1) bot_state: admin-only reads
DROP POLICY IF EXISTS "bot_state read authenticated" ON public.bot_state;
CREATE POLICY "bot_state admin read"
  ON public.bot_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) forum_post_edits: signed-in readers only
DROP POLICY IF EXISTS "Anyone reads edits" ON public.forum_post_edits;
CREATE POLICY "Authenticated read edits"
  ON public.forum_post_edits FOR SELECT TO authenticated
  USING (true);

-- 3) SECURITY DEFINER functions: remove blanket PUBLIC execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_pilots_lite(boolean, integer, integer, industry_vertical, double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_deliverable_share_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_share_payload(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_share_view(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_splat_share_by_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_portfolio(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_pilots() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_pilot(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_pilots_v2(boolean) FROM PUBLIC;

-- signed-in only helpers: drop PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.forum_increment_view(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_marketplace_requests(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unread_thread_counts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_pilot_profile() FROM PUBLIC, anon;
