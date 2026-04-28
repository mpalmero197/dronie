-- Threaded marketplace messages
CREATE TABLE public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  -- "thread" = conversation between the request's client_id and a specific pilot.
  -- pilot_id identifies the other party (always the pilot, never the client).
  pilot_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_request_messages_thread ON public.request_messages(request_id, pilot_id, created_at);
CREATE INDEX idx_request_messages_sender ON public.request_messages(sender_id);

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the user a participant in this request/pilot thread?
CREATE OR REPLACE FUNCTION public.can_access_request_thread(_request_id uuid, _pilot_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_requests r
    WHERE r.id = _request_id
      AND (
        -- request owner is always allowed
        r.client_id = _user_id
        -- the pilot in the thread is allowed if it's themselves
        OR (_pilot_id = _user_id AND (
          -- and they've actually engaged with the request (quoted it or are assigned)
          r.assigned_pilot_id = _user_id
          OR EXISTS (
            SELECT 1 FROM public.service_quotes q
            WHERE q.request_id = r.id AND q.pilot_id = _user_id
          )
        ))
      )
  );
$$;

CREATE POLICY "Thread participants can read messages"
ON public.request_messages
FOR SELECT
TO authenticated
USING (public.can_access_request_thread(request_id, pilot_id, auth.uid()));

CREATE POLICY "Thread participants can send messages"
ON public.request_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.can_access_request_thread(request_id, pilot_id, auth.uid())
  -- sender must actually be one of the two parties in the thread
  AND (
    pilot_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.service_requests r
      WHERE r.id = request_id AND r.client_id = auth.uid()
    )
  )
);

-- Per-user read tracking
CREATE TABLE public.request_message_reads (
  user_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  pilot_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id, pilot_id)
);

ALTER TABLE public.request_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
ON public.request_message_reads
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.can_access_request_thread(request_id, pilot_id, auth.uid()));

-- Unread summary per user
CREATE OR REPLACE FUNCTION public.unread_thread_counts(_user_id uuid)
RETURNS TABLE(request_id uuid, pilot_id uuid, unread integer, last_message_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH threads AS (
    SELECT m.request_id, m.pilot_id,
           max(m.created_at) AS last_message_at,
           count(*) FILTER (
             WHERE m.sender_id <> _user_id
               AND m.created_at > COALESCE(
                 (SELECT r.last_read_at FROM public.request_message_reads r
                  WHERE r.user_id = _user_id AND r.request_id = m.request_id AND r.pilot_id = m.pilot_id),
                 'epoch'::timestamptz
               )
           ) AS unread
    FROM public.request_messages m
    WHERE public.can_access_request_thread(m.request_id, m.pilot_id, _user_id)
    GROUP BY m.request_id, m.pilot_id
  )
  SELECT request_id, pilot_id, unread::int, last_message_at FROM threads;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;
ALTER TABLE public.request_messages REPLICA IDENTITY FULL;