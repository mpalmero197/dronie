-- Enums
CREATE TYPE public.account_type AS ENUM ('pilot','client','both');
CREATE TYPE public.request_status AS ENUM ('open','quoted','assigned','in_progress','delivered','closed');
CREATE TYPE public.quote_status AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE public.industry_vertical AS ENUM (
  'construction','real_estate','agriculture','energy','mining','insurance','government','other'
);

-- Profiles: account type
ALTER TABLE public.profiles
  ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'pilot';

-- service_requests
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  vertical public.industry_vertical NOT NULL DEFAULT 'other',
  deliverables text[] NOT NULL DEFAULT '{}',
  location_label text,
  latitude double precision,
  longitude double precision,
  budget_cents integer,
  deadline date,
  status public.request_status NOT NULL DEFAULT 'open',
  assigned_pilot_id uuid,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view open requests"
  ON public.service_requests FOR SELECT
  TO anon, authenticated
  USING (status = 'open');

CREATE POLICY "Clients manage own requests"
  ON public.service_requests FOR ALL
  TO authenticated
  USING (auth.uid() = client_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Assigned pilot can view request"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (assigned_pilot_id = auth.uid());

CREATE POLICY "Assigned pilot can update request"
  ON public.service_requests FOR UPDATE
  TO authenticated
  USING (assigned_pilot_id = auth.uid())
  WITH CHECK (assigned_pilot_id = auth.uid());

CREATE TRIGGER trg_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_requests_vertical ON public.service_requests(vertical);
CREATE INDEX idx_service_requests_client ON public.service_requests(client_id);

-- service_quotes
CREATE TABLE public.service_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  pilot_id uuid NOT NULL,
  price_cents integer NOT NULL,
  eta_days integer,
  message text,
  status public.quote_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, pilot_id)
);

ALTER TABLE public.service_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots manage own quotes"
  ON public.service_quotes FOR ALL
  TO authenticated
  USING (auth.uid() = pilot_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = pilot_id);

CREATE POLICY "Request owner can view quotes"
  ON public.service_quotes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.id = service_quotes.request_id AND r.client_id = auth.uid()
  ));

CREATE POLICY "Request owner can update quote status"
  ON public.service_quotes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.id = service_quotes.request_id AND r.client_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.service_requests r
    WHERE r.id = service_quotes.request_id AND r.client_id = auth.uid()
  ));

CREATE TRIGGER trg_service_quotes_updated_at
  BEFORE UPDATE ON public.service_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_quotes_request ON public.service_quotes(request_id);
CREATE INDEX idx_service_quotes_pilot ON public.service_quotes(pilot_id);