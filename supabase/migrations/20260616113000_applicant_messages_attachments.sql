-- Applicant chat attachments (image + file) for recruiter <-> worker messages.

ALTER TABLE public.applicant_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'file')),
  ADD COLUMN IF NOT EXISTS attachment_bucket text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

ALTER TABLE public.applicant_messages
  ALTER COLUMN body DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applicant_messages_body_check'
      AND conrelid = 'public.applicant_messages'::regclass
  ) THEN
    ALTER TABLE public.applicant_messages
      DROP CONSTRAINT applicant_messages_body_check;
  END IF;
END$$;

ALTER TABLE public.applicant_messages
  ADD CONSTRAINT applicant_messages_content_or_attachment_check
  CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR (attachment_path IS NOT NULL AND length(trim(attachment_path)) > 0)
  );

CREATE INDEX IF NOT EXISTS applicant_messages_worker_created_with_type_idx
  ON public.applicant_messages (worker_id, created_at DESC, message_type);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'applicant-chat',
  'applicant-chat',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);
