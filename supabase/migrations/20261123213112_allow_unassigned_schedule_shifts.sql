-- Open shifts may be staffed later. Existing tenant RLS and related-record guards remain in force.
ALTER TABLE public.employee_schedule_shifts ALTER COLUMN worker_id DROP NOT NULL;

COMMENT ON COLUMN public.employee_schedule_shifts.worker_id IS
  'Assigned employee (public.workers); NULL means an open, unfilled shift.';

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
  IF NEW.worker_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_worker_tenant
    FROM public.workers
    WHERE id = NEW.worker_id;

    IF v_worker_tenant IS NULL OR v_worker_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Employee does not belong to this organization';
    END IF;
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
