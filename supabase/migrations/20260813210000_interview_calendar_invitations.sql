-- Calendar-style interview invitations: stable UID, attendees, delivery audit.

ALTER TABLE public.interview_schedules
  ADD COLUMN IF NOT EXISTS calendar_uid text,
  ADD COLUMN IF NOT EXISTS calendar_sequence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS organizer_email text,
  ADD COLUMN IF NOT EXISTS invitation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_invitation_sent_at timestamptz;

UPDATE public.interview_schedules
SET calendar_uid = 'brass-interview-' || id::text || '@brasshr.com'
WHERE calendar_uid IS NULL;

ALTER TABLE public.interview_schedules
  ALTER COLUMN calendar_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS interview_schedules_calendar_uid_uidx
  ON public.interview_schedules (calendar_uid);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interview_schedules_meeting_type_chk'
  ) THEN
    ALTER TABLE public.interview_schedules
      ADD CONSTRAINT interview_schedules_meeting_type_chk CHECK (
        meeting_type IN ('online', 'phone', 'in_person')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'interview_schedules_invitation_status_chk'
  ) THEN
    ALTER TABLE public.interview_schedules
      ADD CONSTRAINT interview_schedules_invitation_status_chk CHECK (
        invitation_status IN ('pending', 'sent', 'partial', 'failed')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.interview_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interview_schedules (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  name text NOT NULL,
  attendee_type text NOT NULL DEFAULT 'interviewer',
  response_status text NOT NULL DEFAULT 'needs_action',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_attendees_type_chk CHECK (
    attendee_type IN ('candidate', 'interviewer', 'organizer', 'optional')
  ),
  CONSTRAINT interview_attendees_response_chk CHECK (
    response_status IN ('needs_action', 'accepted', 'declined', 'tentative')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS interview_attendees_interview_email_uidx
  ON public.interview_attendees (interview_id, lower(btrim(email)));

CREATE INDEX IF NOT EXISTS interview_attendees_tenant_interview_idx
  ON public.interview_attendees (tenant_id, interview_id);

CREATE TABLE IF NOT EXISTS public.interview_invitation_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interview_schedules (id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES public.interview_attendees (id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  delivery_type text NOT NULL DEFAULT 'request',
  status text NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_invitation_deliveries_type_chk CHECK (
    delivery_type IN ('request', 'update', 'cancel')
  ),
  CONSTRAINT interview_invitation_deliveries_status_chk CHECK (
    status IN ('pending', 'sent', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS interview_invitation_deliveries_interview_idx
  ON public.interview_invitation_deliveries (tenant_id, interview_id, created_at DESC);

DROP TRIGGER IF EXISTS set_interview_attendees_updated_at ON public.interview_attendees;
CREATE TRIGGER set_interview_attendees_updated_at
BEFORE UPDATE ON public.interview_attendees
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.interview_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_invitation_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interview_schedules_staff ON public.interview_schedules;
CREATE POLICY interview_schedules_staff
  ON public.interview_schedules
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS interview_attendees_staff ON public.interview_attendees;
CREATE POLICY interview_attendees_staff
  ON public.interview_attendees
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS interview_invitation_deliveries_staff ON public.interview_invitation_deliveries;
CREATE POLICY interview_invitation_deliveries_staff
  ON public.interview_invitation_deliveries
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_attendees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_invitation_deliveries TO authenticated;
GRANT ALL ON public.interview_attendees TO service_role;
GRANT ALL ON public.interview_invitation_deliveries TO service_role;

COMMENT ON COLUMN public.interview_schedules.calendar_uid IS
  'Stable iCalendar UID reused for updates and cancellations.';
COMMENT ON TABLE public.interview_attendees IS
  'Interview participants including candidate, interviewers, and organizer.';
COMMENT ON TABLE public.interview_invitation_deliveries IS
  'Audit log for calendar invitation email delivery attempts.';
