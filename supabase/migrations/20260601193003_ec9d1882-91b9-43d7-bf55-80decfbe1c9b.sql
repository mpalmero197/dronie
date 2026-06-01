
-- Helper: insert a notification (security definer so triggers can write for any user)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _kind text,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link, metadata)
  VALUES (_user_id, _kind, _title, _body, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 1) New service_quote -> notify the request owner
CREATE OR REPLACE FUNCTION public.notify_on_new_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _client uuid; _title text;
BEGIN
  SELECT r.client_id, r.title INTO _client, _title
  FROM public.service_requests r WHERE r.id = NEW.request_id;
  IF _client IS NOT NULL AND _client <> NEW.pilot_id THEN
    PERFORM public.create_notification(
      _client,
      'quote',
      'New quote on your request',
      COALESCE(_title, 'A pilot sent you a quote'),
      '/marketplace/' || NEW.request_id::text,
      jsonb_build_object('quote_id', NEW.id, 'pilot_id', NEW.pilot_id, 'request_id', NEW.request_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_quote ON public.service_quotes;
CREATE TRIGGER trg_notify_on_new_quote
AFTER INSERT ON public.service_quotes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_quote();

-- 2) New request_message -> notify the other party in the thread
CREATE OR REPLACE FUNCTION public.notify_on_new_request_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _client uuid; _title text; _recipient uuid;
BEGIN
  SELECT r.client_id, r.title INTO _client, _title
  FROM public.service_requests r WHERE r.id = NEW.request_id;

  IF NEW.sender_id = _client THEN
    _recipient := NEW.pilot_id;
  ELSE
    _recipient := _client;
  END IF;

  IF _recipient IS NOT NULL AND _recipient <> NEW.sender_id THEN
    PERFORM public.create_notification(
      _recipient,
      'message',
      'New message',
      LEFT(NEW.body, 140),
      '/marketplace/' || NEW.request_id::text,
      jsonb_build_object('request_id', NEW.request_id, 'pilot_id', NEW.pilot_id, 'sender_id', NEW.sender_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_request_message ON public.request_messages;
CREATE TRIGGER trg_notify_on_new_request_message
AFTER INSERT ON public.request_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_request_message();

-- 3) Pilot verification status change -> notify the pilot
CREATE OR REPLACE FUNCTION public.notify_on_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _title text; _body text; _kind text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'verified' THEN
    _kind := 'verification_approved';
    _title := 'Verification approved';
    _body := 'You are now a verified pilot. Your profile is live.';
  ELSIF NEW.status = 'rejected' THEN
    _kind := 'verification_rejected';
    _title := 'Verification needs changes';
    _body := COALESCE(NEW.admin_notes, 'Please review your submission and resubmit.');
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.user_id, _kind, _title, _body, '/pilots/verify',
    jsonb_build_object('verification_id', NEW.id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_verification_status ON public.pilot_verifications;
CREATE TRIGGER trg_notify_on_verification_status
AFTER INSERT OR UPDATE ON public.pilot_verifications
FOR EACH ROW EXECUTE FUNCTION public.notify_on_verification_status();

-- 4) New service_request -> notify matching pilots (cap at 25 to avoid storms)
CREATE OR REPLACE FUNCTION public.notify_pilots_on_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row record;
BEGIN
  IF NEW.status <> 'open' THEN RETURN NEW; END IF;

  FOR _row IN
    SELECT p.user_id
    FROM public.pilot_profiles p
    WHERE p.available = true
      AND (NEW.vertical = ANY(p.verticals) OR cardinality(p.verticals) = 0)
      AND (
        NEW.latitude IS NULL OR NEW.longitude IS NULL
        OR p.service_lat IS NULL OR p.service_lng IS NULL
        OR public.haversine_km(NEW.latitude, NEW.longitude, p.service_lat, p.service_lng) <= p.service_radius_km
      )
      AND p.user_id <> NEW.client_id
    LIMIT 25
  LOOP
    PERFORM public.create_notification(
      _row.user_id,
      'request_match',
      'New job matches your profile',
      LEFT(NEW.title, 140),
      '/marketplace/' || NEW.id::text,
      jsonb_build_object('request_id', NEW.id, 'vertical', NEW.vertical)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pilots_on_new_request ON public.service_requests;
CREATE TRIGGER trg_notify_pilots_on_new_request
AFTER INSERT ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_pilots_on_new_request();

-- Helpful index for the bell query
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
