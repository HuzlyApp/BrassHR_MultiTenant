-- Support ticket conversation messages and file attachments

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('applicant', 'staff')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_messages_message_check CHECK (length(trim(message)) > 0)
);

CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_ticket_messages (id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  storage_bucket text NOT NULL DEFAULT 'support-ticket-files',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
  ON public.support_ticket_messages (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS support_ticket_attachments_ticket_idx
  ON public.support_ticket_attachments (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS support_ticket_attachments_message_idx
  ON public.support_ticket_attachments (message_id);

INSERT INTO public.support_ticket_messages (tenant_id, ticket_id, sender_id, sender_role, message, created_at)
SELECT
  t.tenant_id,
  t.id,
  t.user_id,
  'applicant',
  COALESCE(NULLIF(trim(t.description), ''), COALESCE(t.subject, 'Support request')),
  t.created_at
FROM public.support_tickets t
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_ticket_messages m WHERE m.ticket_id = t.id
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_ticket_messages_applicant_select ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_applicant_select
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.applicant_id IS NOT NULL
            AND public.approved_applicant_owns_worker(t.applicant_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS support_ticket_messages_applicant_insert ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_applicant_insert
  ON public.support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'applicant'
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.applicant_id IS NOT NULL
        AND public.approved_applicant_owns_worker(t.applicant_id)
        AND t.status <> 'Closed'
    )
  );

DROP POLICY IF EXISTS support_ticket_messages_staff_select ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_staff_select
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS support_ticket_messages_staff_insert ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_staff_insert
  ON public.support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'staff'
    AND public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.tenant_id = support_ticket_messages.tenant_id
        AND t.applicant_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS support_ticket_attachments_applicant_select ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_applicant_select
  ON public.support_ticket_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.applicant_id IS NOT NULL
            AND public.approved_applicant_owns_worker(t.applicant_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS support_ticket_attachments_applicant_insert ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_applicant_insert
  ON public.support_ticket_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.applicant_id IS NOT NULL
        AND public.approved_applicant_owns_worker(t.applicant_id)
    )
  );

DROP POLICY IF EXISTS support_ticket_attachments_staff_select ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_staff_select
  ON public.support_ticket_attachments
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS support_ticket_attachments_staff_insert ON public.support_ticket_attachments;
CREATE POLICY support_ticket_attachments_staff_insert
  ON public.support_ticket_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.user_is_tenant_staff(tenant_id)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-ticket-files',
  'support-ticket-files',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

COMMENT ON TABLE public.support_ticket_messages IS 'Threaded replies on applicant support tickets.';
COMMENT ON TABLE public.support_ticket_attachments IS 'Files uploaded with support tickets or thread messages.';
