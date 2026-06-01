CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.app_secrets (
  name text PRIMARY KEY,
  value_encrypted bytea NOT NULL,
  hint text,
  category text NOT NULL DEFAULT 'other',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_secrets TO service_role;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage app_secrets"
  ON public.app_secrets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_secrets_updated_at
  BEFORE UPDATE ON public.app_secrets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.encrypt_app_secret(_value text, _key text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_encrypt(_value, _key);
$$;

CREATE OR REPLACE FUNCTION public.decrypt_app_secret(_name text, _key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.pgp_sym_decrypt(value_encrypted, _key)::text
  FROM public.app_secrets
  WHERE name = _name;
$$;

REVOKE EXECUTE ON FUNCTION public.decrypt_app_secret(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_app_secret(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.encrypt_app_secret(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_app_secret(text, text) TO service_role;