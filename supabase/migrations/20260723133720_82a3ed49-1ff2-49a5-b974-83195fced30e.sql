
REVOKE EXECUTE ON FUNCTION public.forum_autosubscribe_author() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.forum_notify_subscribers() FROM PUBLIC, anon, authenticated;
