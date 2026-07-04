
-- 1) analytics_events: tighten always-true INSERT policy
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_name IS NOT NULL
  AND length(event_name) BETWEEN 1 AND 100
  AND (path IS NULL OR length(path) <= 2048)
);

-- 2) Revoke EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.cleanup_mission_versions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_mission_version() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_after_post_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_after_post_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_before_post_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_recount_score() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pilot_verification_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_quote() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_request_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_verification_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_pilots_on_new_request() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_org_member_self_escalation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_app_secret(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_app_secret(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_pilot_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.unread_thread_counts(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_request_thread(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_forum_banned(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.forum_increment_view(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_marketplace_requests(boolean) FROM anon;

-- 3) Reinstall pg_net in extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4) Public storage buckets: remove broad anonymous listing policies
DROP POLICY IF EXISTS "Public can read project outputs" ON storage.objects;
DROP POLICY IF EXISTS "Public can read drone demos" ON storage.objects;
DROP POLICY IF EXISTS "Public read portfolio media" ON storage.objects;
