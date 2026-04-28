-- Status enum
DO $$ BEGIN
  CREATE TYPE public.pilot_verification_status AS ENUM ('unverified','pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add status to pilot_profiles
ALTER TABLE public.pilot_profiles
  ADD COLUMN IF NOT EXISTS verification_status public.pilot_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Verifications table
CREATE TABLE IF NOT EXISTS public.pilot_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  legal_first_name text NOT NULL,
  legal_last_name text NOT NULL,
  date_of_birth date,
  country text NOT NULL,
  region text,
  id_type text NOT NULL,
  id_last4 text NOT NULL,
  part_107_cert_number text,
  insurance_provider text,
  insurance_policy_number text,
  document_urls text[] NOT NULL DEFAULT '{}',
  pilot_notes text,
  status public.pilot_verification_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_verifications_user ON public.pilot_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pilot_verifications_status ON public.pilot_verifications(status);

ALTER TABLE public.pilot_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pilots view own verifications" ON public.pilot_verifications;
CREATE POLICY "Pilots view own verifications" ON public.pilot_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Pilots create own verifications" ON public.pilot_verifications;
CREATE POLICY "Pilots create own verifications" ON public.pilot_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Pilots update own pending verifications" ON public.pilot_verifications;
CREATE POLICY "Pilots update own pending verifications" ON public.pilot_verifications
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND status = 'pending') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid() AND status = 'pending') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete verifications" ON public.pilot_verifications;
CREATE POLICY "Admins delete verifications" ON public.pilot_verifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pilot_verifications_updated
  BEFORE UPDATE ON public.pilot_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync function: when a verification's status changes, mirror to pilot_profiles
CREATE OR REPLACE FUNCTION public.sync_pilot_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pilot_profiles
      SET verification_status = NEW.status,
          verification_rejection_reason = CASE WHEN NEW.status = 'rejected' THEN NEW.admin_notes ELSE NULL END,
          verified_at = CASE WHEN NEW.status = 'verified' THEN now() ELSE verified_at END
      WHERE user_id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.pilot_profiles
      SET verification_status = NEW.status,
          verification_rejection_reason = CASE WHEN NEW.status = 'rejected' THEN NEW.admin_notes ELSE NULL END,
          verified_at = CASE WHEN NEW.status = 'verified' THEN now() ELSE verified_at END
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pilot_verification ON public.pilot_verifications;
CREATE TRIGGER trg_sync_pilot_verification
  AFTER INSERT OR UPDATE ON public.pilot_verifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_pilot_verification_status();