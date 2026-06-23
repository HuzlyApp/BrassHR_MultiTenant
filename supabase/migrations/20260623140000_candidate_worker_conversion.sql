-- Employment records created when converting approved candidates to W-2 or 1099 workers.

CREATE TABLE IF NOT EXISTS public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  worker_type text NOT NULL CHECK (worker_type IN ('w2', '1099')),
  employment_classification text NOT NULL CHECK (employment_classification IN ('employee', 'contractor')),
  tax_withholding_required boolean NOT NULL DEFAULT false,
  payroll_enabled boolean NOT NULL DEFAULT false,
  contractor_payment_enabled boolean NOT NULL DEFAULT false,
  conversion_status text NOT NULL DEFAULT 'converted' CHECK (conversion_status IN ('converted', 'pending')),
  converted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workers_candidate_id_unique UNIQUE (candidate_id)
);

CREATE INDEX IF NOT EXISTS workers_tenant_idx ON public.workers (tenant_id);
CREATE INDEX IF NOT EXISTS workers_candidate_id_idx ON public.workers (candidate_id);

COMMENT ON TABLE public.workers IS
  'Payroll/employment worker records created when converting approved candidates.';

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS converted_worker_type text
    CHECK (converted_worker_type IS NULL OR converted_worker_type IN ('w2', '1099')),
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_workers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workers_updated_at ON public.workers;
CREATE TRIGGER trg_workers_updated_at
BEFORE UPDATE ON public.workers
FOR EACH ROW
EXECUTE FUNCTION public.set_workers_updated_at();

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;

DROP POLICY IF EXISTS workers_staff ON public.workers;
CREATE POLICY workers_staff
  ON public.workers FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS workers_own_read ON public.workers;
CREATE POLICY workers_own_read
  ON public.workers FOR SELECT TO authenticated
  USING (public.approved_applicant_owns_worker(candidate_id));
