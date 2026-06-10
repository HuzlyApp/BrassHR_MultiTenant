-- Support inbound email/SMS in Communication History (direction + received status).

ALTER TABLE public.candidate_communications
  ADD COLUMN IF NOT EXISTS direction text;

ALTER TABLE public.candidate_communications
  DROP CONSTRAINT IF EXISTS candidate_communications_status_check;

ALTER TABLE public.candidate_communications
  ADD CONSTRAINT candidate_communications_status_check
  CHECK (status IN ('sent', 'failed', 'received'));

ALTER TABLE public.candidate_communications
  DROP CONSTRAINT IF EXISTS candidate_communications_direction_check;

ALTER TABLE public.candidate_communications
  ADD CONSTRAINT candidate_communications_direction_check
  CHECK (direction IS NULL OR direction IN ('inbound', 'outbound'));

-- Backfill direction from sent_by_user_id (null = inbound from applicant).
UPDATE public.candidate_communications
SET direction = CASE
  WHEN sent_by_user_id IS NULL THEN 'inbound'
  ELSE 'outbound'
END
WHERE direction IS NULL;

-- Inbound SMS rows used status=sent; mark as received for clarity.
UPDATE public.candidate_communications
SET status = 'received'
WHERE direction = 'inbound'
  AND status = 'sent';

CREATE UNIQUE INDEX IF NOT EXISTS candidate_communications_provider_message_id_uq
  ON public.candidate_communications (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN public.candidate_communications.direction IS
  'inbound = applicant→recruiter; outbound = recruiter→applicant.';
