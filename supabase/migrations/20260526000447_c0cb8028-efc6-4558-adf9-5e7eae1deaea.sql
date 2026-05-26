
CREATE TABLE public.portfolio_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  project_ref TEXT,
  budget_cents INTEGER,
  timeline TEXT,
  source_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_inquiries_owner_created
  ON public.portfolio_inquiries (owner_id, created_at DESC);

ALTER TABLE public.portfolio_inquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry, but only to a published portfolio
CREATE POLICY "Anyone can send inquiry to published portfolio"
ON public.portfolio_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = owner_id
      AND p.portfolio_published = true
      AND p.username IS NOT NULL
  )
);

-- Owners (and admins) can read their own inquiries
CREATE POLICY "Owners view own inquiries"
ON public.portfolio_inquiries
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Owners (and admins) can update (mark read) and delete
CREATE POLICY "Owners update own inquiries"
ON public.portfolio_inquiries
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners delete own inquiries"
ON public.portfolio_inquiries
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
