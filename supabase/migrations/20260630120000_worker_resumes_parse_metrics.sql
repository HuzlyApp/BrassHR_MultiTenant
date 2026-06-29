-- Async resume parse metrics and structured output on worker_resumes
ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS parsed_json jsonb,
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parse_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS parse_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_ms integer,
  ADD COLUMN IF NOT EXISTS ai_parse_ms integer,
  ADD COLUMN IF NOT EXISTS text_length integer;

COMMENT ON COLUMN public.worker_resumes.parsed_json IS 'Structured Grok output (contact/profile fields)';
COMMENT ON COLUMN public.worker_resumes.parse_error IS 'Parse or quality-gate failure message when parsing_status = failed';
