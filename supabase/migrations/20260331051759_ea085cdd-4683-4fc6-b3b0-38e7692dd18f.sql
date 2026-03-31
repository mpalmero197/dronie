
ALTER TABLE public.projects
ADD COLUMN processing_priority integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.projects.processing_priority IS '0=free, 10=professional, 20=enterprise, 99=admin. Higher priority processes first.';

CREATE INDEX idx_projects_processing_queue 
ON public.projects (processing_priority DESC, created_at ASC) 
WHERE status = 'queued';
