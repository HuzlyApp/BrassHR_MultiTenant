-- Recruiter manual call logs on candidate activities (Call 1 / Call 2 pipeline sync).

CREATE TABLE IF NOT EXISTS public.worker_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('answered', 'no_answer')),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  notes text,
  call_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_call_logs_worker_call_at_idx
  ON public.worker_call_logs (worker_id, call_at DESC);

CREATE INDEX IF NOT EXISTS worker_call_logs_tenant_idx
  ON public.worker_call_logs (tenant_id);

COMMENT ON TABLE public.worker_call_logs IS
  'Manual recruiter call logs for candidate activities; syncs to pipeline call_1/call_2 when applicable.';

CREATE OR REPLACE FUNCTION public.set_worker_call_logs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_call_logs_updated_at ON public.worker_call_logs;
CREATE TRIGGER trg_worker_call_logs_updated_at
BEFORE UPDATE ON public.worker_call_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_worker_call_logs_updated_at();

ALTER TABLE public.worker_call_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_call_logs TO authenticated;
GRANT ALL ON public.worker_call_logs TO service_role;

DROP POLICY IF EXISTS worker_call_logs_staff ON public.worker_call_logs;
CREATE POLICY worker_call_logs_staff
  ON public.worker_call_logs
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_call_logs_worker_read ON public.worker_call_logs;
CREATE POLICY worker_call_logs_worker_read
  ON public.worker_call_logs
  FOR SELECT
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));
