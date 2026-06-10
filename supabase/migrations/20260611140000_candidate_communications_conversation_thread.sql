-- Email/SMS conversation threading for Communication History.

ALTER TABLE public.candidate_communications
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS to_email text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS email_references text,
  ADD COLUMN IF NOT EXISTS normalized_subject text;

-- contact_id is the worker (applicant) anchor — same as worker_id.
COMMENT ON COLUMN public.candidate_communications.conversation_id IS
  'Stable thread id: one email conversation per worker, one SMS conversation per worker.';
COMMENT ON COLUMN public.candidate_communications.contact_email IS
  'Normalized external contact email for email-channel rows (applicant, not company inbox).';

CREATE INDEX IF NOT EXISTS candidate_communications_conversation_created_idx
  ON public.candidate_communications (conversation_id, created_at ASC)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS candidate_communications_worker_channel_created_idx
  ON public.candidate_communications (worker_id, channel, created_at ASC);

-- Backfill email rows
UPDATE public.candidate_communications
SET
  from_email = CASE
    WHEN direction = 'inbound' THEN lower(trim(recipient))
    WHEN direction = 'outbound' THEN 'notifications@brasshr.com'
    ELSE from_email
  END,
  to_email = CASE
    WHEN direction = 'inbound' THEN 'notifications@brasshr.com'
    WHEN direction = 'outbound' THEN lower(trim(recipient))
    ELSE to_email
  END,
  contact_email = lower(trim(recipient)),
  normalized_subject = lower(
    regexp_replace(
      regexp_replace(coalesce(subject, ''), '^(re|fwd|fw):\s*', '', 'gi'),
      '^(re|fwd|fw):\s*', '', 'gi'
    )
  )
WHERE channel = 'email'
  AND (from_email IS NULL OR to_email IS NULL OR contact_email IS NULL);

-- Backfill SMS rows (phone as contact anchor in recipient)
UPDATE public.candidate_communications
SET contact_email = NULL
WHERE channel = 'sms' AND contact_email IS NOT NULL;

-- Deterministic conversation_id per worker + channel (matches app buildConversationId).
UPDATE public.candidate_communications cc
SET conversation_id = (
  (
    substr(h, 1, 8) || '-' ||
    substr(h, 9, 4) || '-' ||
    '4' || substr(h, 14, 3) || '-' ||
    '8' || substr(h, 18, 3) || '-' ||
    substr(h, 21, 12)
  )::uuid
)
FROM (
  SELECT
    id,
    encode(
      digest('brasshr:conversation:' || worker_id::text || ':' || channel, 'sha256'),
      'hex'
    ) AS h
  FROM public.candidate_communications
  WHERE conversation_id IS NULL
) AS hashed
WHERE cc.id = hashed.id;
