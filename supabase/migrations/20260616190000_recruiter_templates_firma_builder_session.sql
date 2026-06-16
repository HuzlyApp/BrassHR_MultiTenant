ALTER TABLE public.recruiter_templates
  ADD COLUMN IF NOT EXISTS firma_builder_session_id uuid,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS recruiter_templates_firma_template_idx
  ON public.recruiter_templates (firma_template_id)
  WHERE firma_template_id IS NOT NULL;
