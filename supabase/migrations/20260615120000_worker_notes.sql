-- Recruiter notes on worker/candidate records (visible to the worker in their portal).

CREATE TABLE IF NOT EXISTS public.worker_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_notes_body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS worker_notes_worker_created_idx
  ON public.worker_notes (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS worker_notes_tenant_idx
  ON public.worker_notes (tenant_id);

COMMENT ON TABLE public.worker_notes IS
  'Internal recruiter notes about a worker/candidate. Workers can read notes in the applicant portal.';

CREATE OR REPLACE FUNCTION public.set_worker_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_notes_updated_at ON public.worker_notes;
CREATE TRIGGER trg_worker_notes_updated_at
BEFORE UPDATE ON public.worker_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_worker_notes_updated_at();

ALTER TABLE public.worker_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_notes TO authenticated;
GRANT ALL ON public.worker_notes TO service_role;

DROP POLICY IF EXISTS worker_notes_staff ON public.worker_notes;
CREATE POLICY worker_notes_staff
  ON public.worker_notes FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_notes_worker_read ON public.worker_notes;
CREATE POLICY worker_notes_worker_read
  ON public.worker_notes FOR SELECT TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id));
