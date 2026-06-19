-- Support tickets: staff management fields, closed status, and staff RLS

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('Open', 'Pending', 'In Progress', 'Resolved', 'Closed'));

CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_set_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_set_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_support_tickets_updated_at();

CREATE INDEX IF NOT EXISTS support_tickets_tenant_status_idx
  ON public.support_tickets (tenant_id, status, created_at DESC);

DROP POLICY IF EXISTS support_tickets_staff_select ON public.support_tickets;
CREATE POLICY support_tickets_staff_select
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    applicant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS support_tickets_staff_update ON public.support_tickets;
CREATE POLICY support_tickets_staff_update
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    applicant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
  )
  WITH CHECK (
    applicant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
  );

COMMENT ON COLUMN public.support_tickets.recruiter_id IS 'Assigned recruiter/staff user for the ticket.';
COMMENT ON COLUMN public.support_tickets.updated_at IS 'Last update timestamp for ticket metadata.';
COMMENT ON COLUMN public.support_tickets.closed_at IS 'When the ticket was closed by staff.';
COMMENT ON COLUMN public.support_tickets.closed_by IS 'Staff user who closed the ticket.';
