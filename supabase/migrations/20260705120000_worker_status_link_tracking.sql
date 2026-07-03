-- Track applicant onboarding status / continuation link emails per worker profile.

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS status_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_link_email text,
  ADD COLUMN IF NOT EXISTS status_link_last_error text;

COMMENT ON COLUMN public.worker.status_link_sent_at IS
  'When the applicant last received an onboarding continuation/status link email after profile save.';
COMMENT ON COLUMN public.worker.status_link_email IS
  'Recipient email used for the last successful status link send.';
COMMENT ON COLUMN public.worker.status_link_last_error IS
  'Last error or skip reason when sending the profile status link email failed.';
