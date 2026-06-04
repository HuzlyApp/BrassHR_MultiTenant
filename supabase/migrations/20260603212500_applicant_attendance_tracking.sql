-- Approved applicant attendance / time tracking with IP and location verification.

CREATE TABLE IF NOT EXISTS public.applicant_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'clocked_out')),
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  clock_out_at timestamptz,
  total_seconds integer,
  clock_in_ip text NOT NULL,
  clock_out_ip text,
  clock_in_latitude numeric(10, 7) NOT NULL,
  clock_in_longitude numeric(10, 7) NOT NULL,
  clock_out_latitude numeric(10, 7),
  clock_out_longitude numeric(10, 7),
  clock_in_location_timestamp timestamptz NOT NULL,
  clock_out_location_timestamp timestamptz,
  clock_in_location_permission_status text NOT NULL CHECK (clock_in_location_permission_status IN ('granted')),
  clock_out_location_permission_status text CHECK (clock_out_location_permission_status IN ('granted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at),
  CHECK (total_seconds IS NULL OR total_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS applicant_attendance_one_active_session_idx
  ON public.applicant_attendance_logs (worker_id)
  WHERE status = 'clocked_in';

CREATE INDEX IF NOT EXISTS applicant_attendance_tenant_date_idx
  ON public.applicant_attendance_logs (tenant_id, attendance_date DESC, status);

CREATE INDEX IF NOT EXISTS applicant_attendance_worker_date_idx
  ON public.applicant_attendance_logs (worker_id, attendance_date DESC);

ALTER TABLE public.applicant_attendance_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.applicant_attendance_logs IS
  'Approved applicant clock-in/out records with IP address and browser location verification.';
