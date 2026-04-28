-- AI Insights storage: cached structured site reports + follow-up Q&A history
CREATE TABLE public.project_ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  summary TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_ai_reports_project ON public.project_ai_reports(project_id, created_at DESC);

ALTER TABLE public.project_ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own AI reports"
ON public.project_ai_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own AI reports"
ON public.project_ai_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own AI reports"
ON public.project_ai_reports FOR DELETE
USING (auth.uid() = user_id);

-- Q&A follow-ups against an existing report
CREATE TABLE public.project_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_ai_messages_project ON public.project_ai_messages(project_id, created_at);

ALTER TABLE public.project_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own AI messages"
ON public.project_ai_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own AI messages"
ON public.project_ai_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own AI messages"
ON public.project_ai_messages FOR DELETE
USING (auth.uid() = user_id);