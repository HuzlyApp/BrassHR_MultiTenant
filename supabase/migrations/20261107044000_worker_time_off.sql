-- Time off shown on the recruiter "Who is off" schedule.
-- One row is one person's leave span. Day count is derived from the dates.

CREATE TABLE IF NOT EXISTS public.worker_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facility (id) ON DELETE SET NULL,
  off_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_time_off_type_allowed CHECK (
    off_type IN ('Vacation', 'Sick Leave', 'Personal Leave', 'Training', 'Regular Off')
  ),
  CONSTRAINT worker_time_off_dates_ordered CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.worker_time_off IS
  'Leave spans shown on the recruiter Who is off schedule. Each row is one person off across a date range.';

COMMENT ON COLUMN public.worker_time_off.worker_id IS
  'Person in public.worker. This screen lists those profiles, not payroll rows in public.workers.';

COMMENT ON COLUMN public.worker_time_off.days IS
  'Inclusive calendar days from start_date through end_date.';

CREATE INDEX IF NOT EXISTS worker_time_off_tenant_dates_idx
  ON public.worker_time_off (tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS worker_time_off_worker_id_idx
  ON public.worker_time_off (worker_id);

CREATE INDEX IF NOT EXISTS worker_time_off_facility_id_idx
  ON public.worker_time_off (facility_id)
  WHERE facility_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_worker_time_off_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_worker_tenant uuid;
  v_facility_tenant uuid;
BEGIN
  SELECT tenant_id
  INTO v_worker_tenant
  FROM public.worker
  WHERE id = NEW.worker_id;

  IF v_worker_tenant IS NULL OR v_worker_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Worker does not belong to this organization';
  END IF;

  IF NEW.facility_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_facility_tenant
    FROM public.facility
    WHERE id = NEW.facility_id;

    IF v_facility_tenant IS NULL OR v_facility_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Facility does not belong to this organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_worker_time_off_scope() IS
  'Rejects time off whose worker or facility belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_worker_time_off_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_worker_time_off_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_worker_time_off_scope() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_worker_time_off_assert_scope ON public.worker_time_off;
CREATE TRIGGER trg_worker_time_off_assert_scope
  BEFORE INSERT OR UPDATE OF tenant_id, worker_id, facility_id
  ON public.worker_time_off
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_worker_time_off_scope();

DROP TRIGGER IF EXISTS trg_worker_time_off_set_updated_at ON public.worker_time_off;
CREATE TRIGGER trg_worker_time_off_set_updated_at
  BEFORE UPDATE ON public.worker_time_off
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.worker_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_time_off FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_time_off_staff_select ON public.worker_time_off;
CREATE POLICY worker_time_off_staff_select
  ON public.worker_time_off
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

DROP POLICY IF EXISTS worker_time_off_staff_write ON public.worker_time_off;
CREATE POLICY worker_time_off_staff_write
  ON public.worker_time_off
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

REVOKE ALL ON TABLE public.worker_time_off FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.worker_time_off TO authenticated;
GRANT ALL ON TABLE public.worker_time_off TO service_role;

NOTIFY pgrst, 'reload schema';
