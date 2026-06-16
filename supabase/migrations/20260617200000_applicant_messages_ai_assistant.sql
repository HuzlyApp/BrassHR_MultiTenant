-- AI assistant messages in applicant portal chat

ALTER TABLE public.applicant_messages
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.applicant_messages
  DROP CONSTRAINT IF EXISTS applicant_messages_sender_role_check;

ALTER TABLE public.applicant_messages
  ADD CONSTRAINT applicant_messages_sender_role_check
  CHECK (sender_role IN ('applicant', 'recruiter', 'ai'));

COMMENT ON COLUMN public.applicant_messages.sender_name IS 'Display name for AI assistant messages.';
COMMENT ON COLUMN public.applicant_messages.metadata IS 'AI response metadata: buttons, faq_id, ticket_id, response type.';
