
-- Author lookup used by the forum UI. Safe: returns only public display fields.
CREATE OR REPLACE FUNCTION public.get_forum_authors(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, username text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.username, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_forum_authors(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forum_authors(uuid[]) TO anon, authenticated;

-- Per-category thread & post counts.
CREATE OR REPLACE FUNCTION public.get_forum_category_stats()
RETURNS TABLE(category_id uuid, thread_count bigint, post_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.category_id,
    count(*)::bigint AS thread_count,
    (count(*) + COALESCE(sum(t.reply_count), 0))::bigint AS post_count
  FROM public.forum_threads t
  GROUP BY t.category_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_forum_category_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forum_category_stats() TO anon, authenticated;

-- Set bot avatar
UPDATE public.profiles
SET avatar_url = '/__l5e/assets-v1/6f0c4c46-ed0b-43c5-aeb8-f3c3449132ba/dronie-bot-avatar.png'
WHERE username = 'dronie_bot';
