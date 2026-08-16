-- MSP Recruit & EOR (tenant EOR) rows require eor_tenant_id (legacy staging constraint).

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS eor_tenant_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_requisitions_eor_tenant_id_fkey'
      AND conrelid = 'public.job_requisitions'::regclass
  ) THEN
    ALTER TABLE public.job_requisitions
      ADD CONSTRAINT job_requisitions_eor_tenant_id_fkey
      FOREIGN KEY (eor_tenant_id)
      REFERENCES public.tenants (id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_eor_required_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_eor_required_check
  CHECK (
    placement_type IS DISTINCT FROM 'Recruit_and_EOR'
    OR (
      eor_type = 'Tenant'
      AND eor_tenant_id IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.job_requisitions
  VALIDATE CONSTRAINT job_requisitions_eor_required_check;

COMMENT ON COLUMN public.job_requisitions.eor_tenant_id IS
  'Tenant that employs the worker for Recruit_and_EOR placements (eor_type = Tenant).';
