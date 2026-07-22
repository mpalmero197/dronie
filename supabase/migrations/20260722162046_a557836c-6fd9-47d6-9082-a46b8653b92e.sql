
-- Fix voting: RLS needs to be able to call is_forum_banned
GRANT EXECUTE ON FUNCTION public.is_forum_banned(uuid) TO authenticated;

-- Attachments (array of public URLs, capped at 10)
ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS attachments text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.forum_threads
  DROP CONSTRAINT IF EXISTS forum_threads_attachments_len;
ALTER TABLE public.forum_threads
  ADD CONSTRAINT forum_threads_attachments_len
  CHECK (cardinality(attachments) <= 10);

ALTER TABLE public.forum_posts
  DROP CONSTRAINT IF EXISTS forum_posts_attachments_len;
ALTER TABLE public.forum_posts
  ADD CONSTRAINT forum_posts_attachments_len
  CHECK (cardinality(attachments) <= 10);
