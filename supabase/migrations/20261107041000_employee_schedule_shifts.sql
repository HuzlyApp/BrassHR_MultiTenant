-- Per-employee day shifts for the recruiter week view.
-- One row is one block on the schedule grid (employee x date).

CREATE TABLE IF NOT EXISTS public.employee_schedule_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facility (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  work_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  title text NOT NULL,
  rate_per_hour numeric(10, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_schedule_shifts_title_not_empty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT employee_schedule_shifts_times_differ CHECK (start_time <> end_time),
  CONSTRAINT employee_schedule_shifts_rate_nonnegative CHECK (rate_per_hour IS NULL OR rate_per_hour >= 0)
);

COMMENT ON TABLE public.employee_schedule_shifts IS
  'Assigned work blocks shown on the recruiter week schedule. Each row is one employee on one date.';

COMMENT ON COLUMN public.employee_schedule_shifts.worker_id IS
  'Hired employee (public.workers), not an applicant in public.worker.';

COMMENT ON COLUMN public.employee_schedule_shifts.start_time IS
  'Wall-clock start. Overnight shifts may have end_time earlier than start_time.';

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_tenant_date_idx
  ON public.employee_schedule_shifts (tenant_id, work_date);

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_worker_date_idx
  ON public.employee_schedule_shifts (worker_id, work_date);

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_facility_id_idx
  ON public.employee_schedule_shifts (facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_department_id_idx
  ON public.employee_schedule_shifts (department_id)
  WHERE department_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_employee_schedule_shift_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_worker_tenant uuid;
  v_facility_tenant uuid;
  v_department_tenant uuid;
BEGIN
  SELECT tenant_id
  INTO v_worker_tenant
  FROM public.workers
  WHERE id = NEW.worker_id;

  IF v_worker_tenant IS NULL OR v_worker_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Employee does not belong to this organization';
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

  IF NEW.department_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_department_tenant
    FROM public.departments
    WHERE id = NEW.department_id;

    IF v_department_tenant IS NULL OR v_department_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Department does not belong to this organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_employee_schedule_shift_scope() IS
  'Rejects a schedule shift whose employee, facility, or department belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_employee_schedule_shift_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_employee_schedule_shift_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_employee_schedule_shift_scope() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_employee_schedule_shifts_assert_scope ON public.employee_schedule_shifts;
CREATE TRIGGER trg_employee_schedule_shifts_assert_scope
  BEFORE INSERT OR UPDATE OF tenant_id, worker_id, facility_id, department_id
  ON public.employee_schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_employee_schedule_shift_scope();

DROP TRIGGER IF EXISTS trg_employee_schedule_shifts_set_updated_at ON public.employee_schedule_shifts;
CREATE TRIGGER trg_employee_schedule_shifts_set_updated_at
  BEFORE UPDATE ON public.employee_schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_schedule_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_schedule_shifts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_schedule_shifts_staff_select ON public.employee_schedule_shifts;
CREATE POLICY employee_schedule_shifts_staff_select
  ON public.employee_schedule_shifts
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

DROP POLICY IF EXISTS employee_schedule_shifts_staff_write ON public.employee_schedule_shifts;
CREATE POLICY employee_schedule_shifts_staff_write
  ON public.employee_schedule_shifts
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

REVOKE ALL ON TABLE public.employee_schedule_shifts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_schedule_shifts TO authenticated;
GRANT ALL ON TABLE public.employee_schedule_shifts TO service_role;

NOTIFY pgrst, 'reload schema';
