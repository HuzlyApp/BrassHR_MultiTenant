-- Approved applicant appointment / interview scheduling.

CREATE TABLE IF NOT EXISTS public.applicant_appointment_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  meeting_type text NOT NULL CHECK (meeting_type IN ('online', 'phone', 'in_person')),
  meeting_link text,
  location text,
  notes text,
  is_available boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_appointment_slots_tenant_starts_idx
  ON public.applicant_appointment_slots (tenant_id, starts_at)
  WHERE is_available = true;

CREATE TABLE IF NOT EXISTS public.applicant_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.applicant_appointment_slots (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'rescheduled', 'cancelled')),
  meeting_type text CHECK (meeting_type IN ('online', 'phone', 'in_person')),
  confirmed_starts_at timestamptz,
  confirmed_ends_at timestamptz,
  meeting_link text,
  location text,
  reschedule_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_appointments_worker_updated_idx
  ON public.applicant_appointments (worker_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS applicant_appointments_tenant_status_idx
  ON public.applicant_appointments (tenant_id, status, updated_at DESC);

ALTER TABLE public.applicant_appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_appointments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.applicant_appointment_slots IS
  'Recruiter-provided appointment/interview/orientation slots for approved applicants.';

COMMENT ON TABLE public.applicant_appointments IS
  'Applicant appointment requests and confirmed meeting details.';
