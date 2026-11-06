-- Daily timesheet rows for hired employees on the recruiter timesheets page.
-- One row is one employee on one work date.

CREATE TABLE IF NOT EXISTS public.employee_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facility (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  work_date date NOT NULL,
  regular_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  break_minutes integer NOT NULL DEFAULT 0,
  clock_in time,
  clock_out time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_timesheet_entries_worker_date_unique UNIQUE (worker_id, work_date),
  CONSTRAINT employee_timesheet_entries_minutes_bounds CHECK (
    regular_minutes >= 0
    AND regular_minutes <= 1440
    AND overtime_minutes >= 0
    AND overtime_minutes <= 1440
    AND break_minutes >= 0
    AND break_minutes <= 1440
  )
);

COMMENT ON TABLE public.employee_timesheet_entries IS
  'Daily worked time for a hired employee. The recruiter timesheets week view aggregates these rows.';

COMMENT ON COLUMN public.employee_timesheet_entries.worker_id IS
  'Hired employee (public.workers), not an applicant in public.worker.';

COMMENT ON COLUMN public.employee_timesheet_entries.regular_minutes IS
  'Worked minutes that count toward the weekly regular total.';

COMMENT ON COLUMN public.employee_timesheet_entries.overtime_minutes IS
  'Worked minutes that count as overtime for this date.';

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_tenant_date_idx
  ON public.employee_timesheet_entries (tenant_id, work_date);

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_facility_id_idx
  ON public.employee_timesheet_entries (facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_department_id_idx
  ON public.employee_timesheet_entries (department_id)
  WHERE department_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_employee_timesheet_entry_scope()
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

COMMENT ON FUNCTION public.assert_employee_timesheet_entry_scope() IS
  'Rejects a timesheet entry whose employee, facility, or department belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_employee_timesheet_entry_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_employee_timesheet_entry_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_employee_timesheet_entry_scope() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_employee_timesheet_entries_assert_scope ON public.employee_timesheet_entries;
CREATE TRIGGER trg_employee_timesheet_entries_assert_scope
  BEFORE INSERT OR UPDATE OF tenant_id, worker_id, facility_id, department_id
  ON public.employee_timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_employee_timesheet_entry_scope();

DROP TRIGGER IF EXISTS trg_employee_timesheet_entries_set_updated_at ON public.employee_timesheet_entries;
CREATE TRIGGER trg_employee_timesheet_entries_set_updated_at
  BEFORE UPDATE ON public.employee_timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_timesheet_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_timesheet_entries_staff_select ON public.employee_timesheet_entries;
CREATE POLICY employee_timesheet_entries_staff_select
  ON public.employee_timesheet_entries
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

DROP POLICY IF EXISTS employee_timesheet_entries_staff_write ON public.employee_timesheet_entries;
CREATE POLICY employee_timesheet_entries_staff_write
  ON public.employee_timesheet_entries
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

REVOKE ALL ON TABLE public.employee_timesheet_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_timesheet_entries TO authenticated;
GRANT ALL ON TABLE public.employee_timesheet_entries TO service_role;

NOTIFY pgrst, 'reload schema';
