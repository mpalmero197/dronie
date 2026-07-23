
-- Forum subscriptions table
CREATE TABLE public.forum_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, thread_id)
);

GRANT SELECT, INSERT, DELETE ON public.forum_subscriptions TO authenticated;
GRANT ALL ON public.forum_subscriptions TO service_role;

ALTER TABLE public.forum_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subs" ON public.forum_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own subs" ON public.forum_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own subs" ON public.forum_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX forum_subs_thread_idx ON public.forum_subscriptions(thread_id);

-- Auto-subscribe thread authors on thread creation
CREATE OR REPLACE FUNCTION public.forum_autosubscribe_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.forum_subscriptions (user_id, thread_id)
  VALUES (NEW.author_id, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS forum_threads_autosub ON public.forum_threads;
CREATE TRIGGER forum_threads_autosub
  AFTER INSERT ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.forum_autosubscribe_author();

-- Notify subscribers on new reply
CREATE OR REPLACE FUNCTION public.forum_notify_subscribers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row record; _title text;
BEGIN
  SELECT title INTO _title FROM public.forum_threads WHERE id = NEW.thread_id;
  FOR _row IN
    SELECT user_id FROM public.forum_subscriptions
    WHERE thread_id = NEW.thread_id AND user_id <> NEW.author_id
  LOOP
    PERFORM public.create_notification(
      _row.user_id,
      'forum_reply',
      'New reply in a thread you follow',
      LEFT(COALESCE(_title, 'A thread you follow has a new reply'), 140),
      '/community/t/' || NEW.thread_id::text,
      jsonb_build_object('thread_id', NEW.thread_id, 'post_id', NEW.id, 'author_id', NEW.author_id)
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS forum_posts_notify_subs ON public.forum_posts;
CREATE TRIGGER forum_posts_notify_subs
  AFTER INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_notify_subscribers();
