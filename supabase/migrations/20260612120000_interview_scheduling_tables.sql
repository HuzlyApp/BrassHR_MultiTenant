-- Interview scheduling tables (admin Schedule Interview modal).
-- Extends existing public.applicants (multi-tenant) and adds interview_schedules + interview_slots.

-- ---------------------------------------------------------------------------
-- applicants (create if missing, then extend)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  full_name text,
  email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS applicants_tenant_worker_uidx
  ON public.applicants (tenant_id, worker_id)
  WHERE worker_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- interview_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.applicants (id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,

  title text NOT NULL DEFAULT 'Initial Interview',
  description text,

  scheduled_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Manila',

  status text NOT NULL DEFAULT 'upcoming',
  meeting_link text,
  notes text,

  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interview_schedules_status_check
    CHECK (status IN ('upcoming', 'completed', 'cancelled', 'rescheduled')),

  CONSTRAINT interview_schedules_time_check
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_tenant_id
  ON public.interview_schedules (tenant_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_applicant_id
  ON public.interview_schedules (applicant_id);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_date
  ON public.interview_schedules (scheduled_date);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_status
  ON public.interview_schedules (status);

CREATE INDEX IF NOT EXISTS idx_interview_schedules_tenant_date
  ON public.interview_schedules (tenant_id, scheduled_date DESC);

-- ---------------------------------------------------------------------------
-- interview_slots (reusable availability)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,

  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Manila',

  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interview_slots_time_check
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_interview_slots_date
  ON public.interview_slots (slot_date);

CREATE INDEX IF NOT EXISTS idx_interview_slots_tenant_date
  ON public.interview_slots (tenant_id, slot_date)
  WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared helper)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_interview_schedules_updated_at ON public.interview_schedules;

CREATE TRIGGER set_interview_schedules_updated_at
BEFORE UPDATE ON public.interview_schedules
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.interview_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.interview_schedules IS
  'Confirmed and upcoming applicant interviews scheduled by recruiters.';

COMMENT ON TABLE public.interview_slots IS
  'Optional reusable interview time slots for recruiter availability.';
