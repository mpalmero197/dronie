
-- ============== FORUM CATEGORIES ==============
CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories TO authenticated;
GRANT ALL ON public.forum_categories TO service_role;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.forum_categories FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== FORUM BANS ==============
CREATE TABLE public.forum_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text,
  banned_by uuid,
  banned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_bans TO authenticated;
GRANT ALL ON public.forum_bans TO service_role;
ALTER TABLE public.forum_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own ban" ON public.forum_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage bans" ON public.forum_bans FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_forum_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forum_bans
    WHERE user_id = _user_id
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- ============== THREADS ==============
CREATE TABLE public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  slug text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  view_count int NOT NULL DEFAULT 0,
  reply_count int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_threads_category_idx ON public.forum_threads(category_id, last_activity_at DESC);
CREATE INDEX forum_threads_author_idx ON public.forum_threads(author_id);
GRANT SELECT ON public.forum_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_threads TO authenticated;
GRANT ALL ON public.forum_threads TO service_role;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads threads" ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Auth users create threads" ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT public.is_forum_banned(auth.uid()));
CREATE POLICY "Authors update own threads" ON public.forum_threads FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND NOT locked) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Admins manage threads" ON public.forum_threads FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authors delete own threads" ON public.forum_threads FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ============== POSTS ==============
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  score int NOT NULL DEFAULT 0,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forum_posts_thread_idx ON public.forum_posts(thread_id, created_at);
CREATE INDEX forum_posts_author_idx ON public.forum_posts(author_id);
GRANT SELECT ON public.forum_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT ALL ON public.forum_posts TO service_role;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads posts" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Auth users create posts" ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND NOT public.is_forum_banned(auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.forum_threads t WHERE t.id = thread_id AND t.locked)
  );
CREATE POLICY "Authors update own posts" ON public.forum_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors delete own posts" ON public.forum_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "Admins manage posts" ON public.forum_posts FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== POST EDIT HISTORY ==============
CREATE TABLE public.forum_post_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL,
  previous_body text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_post_edits TO anon;
GRANT SELECT, INSERT ON public.forum_post_edits TO authenticated;
GRANT ALL ON public.forum_post_edits TO service_role;
ALTER TABLE public.forum_post_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads edits" ON public.forum_post_edits FOR SELECT USING (true);
CREATE POLICY "Auth insert edits" ON public.forum_post_edits FOR INSERT TO authenticated
  WITH CHECK (editor_id = auth.uid());

-- ============== VOTES ==============
CREATE TABLE public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((thread_id IS NOT NULL)::int + (post_id IS NOT NULL)::int = 1),
  UNIQUE (user_id, thread_id),
  UNIQUE (user_id, post_id)
);
GRANT SELECT ON public.forum_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_votes TO authenticated;
GRANT ALL ON public.forum_votes TO service_role;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads votes" ON public.forum_votes FOR SELECT USING (true);
CREATE POLICY "Auth users vote" ON public.forum_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_forum_banned(auth.uid()));
CREATE POLICY "Users update own votes" ON public.forum_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own votes" ON public.forum_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============== REPORTS ==============
CREATE TABLE public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((thread_id IS NOT NULL)::int + (post_id IS NOT NULL)::int = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_reports TO authenticated;
GRANT ALL ON public.forum_reports TO service_role;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporter or admin reads" ON public.forum_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Auth users report" ON public.forum_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins manage reports" ON public.forum_reports FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== TRIGGERS ==============
CREATE TRIGGER forum_categories_updated BEFORE UPDATE ON public.forum_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER forum_threads_updated BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER forum_posts_updated BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bump thread reply_count + last_activity_at on new post
CREATE OR REPLACE FUNCTION public.forum_after_post_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.forum_threads
    SET reply_count = reply_count + 1, last_activity_at = now()
    WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
CREATE TRIGGER forum_posts_after_insert AFTER INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_after_post_insert();

CREATE OR REPLACE FUNCTION public.forum_after_post_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.forum_threads
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = OLD.thread_id;
  RETURN OLD;
END $$;
CREATE TRIGGER forum_posts_after_delete AFTER DELETE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_after_post_delete();

-- Record edit history when post body changes
CREATE OR REPLACE FUNCTION public.forum_before_post_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO public.forum_post_edits(post_id, thread_id, editor_id, previous_body)
      VALUES (OLD.id, OLD.thread_id, auth.uid(), OLD.body);
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER forum_posts_before_update BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.forum_before_post_update();

-- Recompute score on vote changes
CREATE OR REPLACE FUNCTION public.forum_recount_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _tid uuid; _pid uuid;
BEGIN
  _tid := COALESCE(NEW.thread_id, OLD.thread_id);
  _pid := COALESCE(NEW.post_id, OLD.post_id);
  IF _tid IS NOT NULL THEN
    UPDATE public.forum_threads SET score = COALESCE((
      SELECT SUM(value)::int FROM public.forum_votes WHERE thread_id = _tid
    ), 0) WHERE id = _tid;
  END IF;
  IF _pid IS NOT NULL THEN
    UPDATE public.forum_posts SET score = COALESCE((
      SELECT SUM(value)::int FROM public.forum_votes WHERE post_id = _pid
    ), 0) WHERE id = _pid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER forum_votes_recount AFTER INSERT OR UPDATE OR DELETE ON public.forum_votes
  FOR EACH ROW EXECUTE FUNCTION public.forum_recount_score();

-- Atomic view-count bump
CREATE OR REPLACE FUNCTION public.forum_increment_view(_thread_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.forum_threads SET view_count = view_count + 1 WHERE id = _thread_id;
$$;

-- Seed default categories
INSERT INTO public.forum_categories (slug,title,description,icon,sort_order) VALUES
  ('announcements','Announcements','Official news from the Dronie team','megaphone',1),
  ('general','General Discussion','Anything drone-related','message-circle',2),
  ('flight-planning','Flight Planning','Mission design, terrain following, exports','map',3),
  ('photogrammetry','Photogrammetry & Mapping','Processing, GCPs, accuracy, deliverables','layers',4),
  ('gear','Gear & Hardware','Drones, cameras, RTK, accessories','wrench',5),
  ('part-107','Part 107 & Regulations','FAA rules, LAANC, waivers, study tips','book-open',6),
  ('showcase','Showcase','Share your shots, splats, and projects','camera',7),
  ('marketplace','Marketplace & Jobs','Hiring, gigs, pricing','briefcase',8),
  ('support','Help & Support','Questions about Dronie','life-buoy',9);
