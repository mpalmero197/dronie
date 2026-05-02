
-- 1. Pilot Stripe Connect accounts
CREATE TABLE public.pilot_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_stripe_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots view own connect account"
  ON public.pilot_stripe_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pilots insert own connect account"
  ON public.pilot_stripe_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_pilot_stripe_accounts_updated_at
  BEFORE UPDATE ON public.pilot_stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Marketplace payments
CREATE TABLE public.marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  client_id UUID NOT NULL,
  pilot_id UUID NOT NULL,
  amount_pilot_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  amount_total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view own payments"
  ON public.marketplace_payments FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR pilot_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_marketplace_payments_updated_at
  BEFORE UPDATE ON public.marketplace_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. service_quotes payment_status
ALTER TABLE public.service_quotes
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- 4. service_requests early-access window
ALTER TABLE public.service_requests
  ADD COLUMN released_to_free_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours');

-- 5. Updated public pilots RPC: redact for non-paying viewers
CREATE OR REPLACE FUNCTION public.get_public_pilots_v2(_is_paid BOOLEAN DEFAULT false)
RETURNS TABLE(
  pilot_id uuid,
  display_name text,
  bio text,
  service_area_label text,
  display_lat double precision,
  display_lng double precision,
  service_radius_km integer,
  verticals industry_vertical[],
  skills text[],
  equipment text[],
  hourly_rate_cents integer,
  years_experience integer,
  part_107 boolean,
  insured boolean,
  portfolio_url text,
  avatar_url text,
  is_redacted boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    CASE WHEN _is_paid THEN p.display_name ELSE 'Verified Pilot' END,
    CASE WHEN _is_paid THEN p.bio ELSE NULL END,
    CASE WHEN _is_paid THEN p.service_area_label ELSE split_part(COALESCE(p.service_area_label,''), ',', -1) END,
    COALESCE(p.display_lat, p.service_lat),
    COALESCE(p.display_lng, p.service_lng),
    p.service_radius_km,
    p.verticals,
    CASE WHEN _is_paid THEN p.skills ELSE ARRAY[]::text[] END,
    CASE WHEN _is_paid THEN p.equipment ELSE ARRAY[]::text[] END,
    p.hourly_rate_cents,
    p.years_experience,
    p.part_107,
    p.insured,
    CASE WHEN _is_paid THEN p.portfolio_url ELSE NULL END,
    CASE WHEN _is_paid THEN pr.avatar_url ELSE NULL END,
    NOT _is_paid
  FROM public.pilot_profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE p.available = true
    AND p.show_on_map = true
    AND COALESCE(p.display_lat, p.service_lat) IS NOT NULL
    AND COALESCE(p.display_lng, p.service_lng) IS NOT NULL;
$$;

-- 6. Tier-gated marketplace requests RPC (Enterprise gets 24h early access)
CREATE OR REPLACE FUNCTION public.get_marketplace_requests(_is_top_tier BOOLEAN DEFAULT false)
RETURNS SETOF public.service_requests
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.service_requests
  WHERE status = 'open'
    AND (_is_top_tier OR released_to_free_at <= now());
$$;
