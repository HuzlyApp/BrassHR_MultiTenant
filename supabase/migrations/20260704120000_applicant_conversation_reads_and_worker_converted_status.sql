-- Per-staff-user read tracking for applicant messaging unread counts.
CREATE TABLE IF NOT EXISTS public.applicant_conversation_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_conversation_reads_user_worker_uidx UNIQUE (user_id, worker_id)
);

CREATE INDEX IF NOT EXISTS applicant_conversation_reads_user_idx
  ON public.applicant_conversation_reads (user_id);

CREATE INDEX IF NOT EXISTS applicant_conversation_reads_worker_idx
  ON public.applicant_conversation_reads (worker_id);

ALTER TABLE public.applicant_conversation_reads ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_conversation_reads TO authenticated;
GRANT ALL ON public.applicant_conversation_reads TO service_role;

DROP POLICY IF EXISTS applicant_conversation_reads_staff ON public.applicant_conversation_reads;
CREATE POLICY applicant_conversation_reads_staff
  ON public.applicant_conversation_reads FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

-- Allow pipeline status `converted` on candidate rows (set by worker conversion flow).
-- Drop legacy constraint first; re-add only if no invalid rows remain.
ALTER TABLE public.worker DROP CONSTRAINT IF EXISTS worker_status_chk;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.worker w
    WHERE w.status IS NOT NULL
      AND w.status NOT IN (
        'new', 'pending', 'approved', 'disapproved', 'converted', 'under_review'
      )
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_status_chk
      CHECK (
        status IS NULL
        OR status IN (
          'new', 'pending', 'approved', 'disapproved', 'converted', 'under_review'
        )
      );
  END IF;
END $$;
