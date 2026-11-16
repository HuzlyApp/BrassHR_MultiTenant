-- Internal scheduling reuses existing shifts and employee calendar blocks.
ALTER TABLE public.shifts ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN facility_id DROP NOT NULL;
ALTER TABLE public.shifts ADD COLUMN is_internal boolean NOT NULL DEFAULT false;
ALTER TABLE public.shifts ADD COLUMN department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.shifts ADD CONSTRAINT shifts_fsd_dates CHECK (end_date IS NULL OR end_date >= start_date) NOT VALID;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_fsd_people CHECK (number_of_people_needed IS NULL OR number_of_people_needed > 0) NOT VALID;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_fsd_rate CHECK (rate_per_hour IS NULL OR rate_per_hour >= 0) NOT VALID;
CREATE INDEX shifts_tenant_dates_idx ON public.shifts(tenant_id,start_date,end_date);
CREATE INDEX shifts_department_idx ON public.shifts(tenant_id,department_id) WHERE department_id IS NOT NULL;

ALTER TABLE public.worker_shift_assignments
  ADD COLUMN facility_id uuid REFERENCES public.facility(id),
  ADD COLUMN client_id uuid REFERENCES public.clients(id),
  ADD COLUMN job_role text,
  ADD COLUMN pay_rate numeric(12,2),
  ADD COLUMN bill_rate numeric(12,2),
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;
ALTER TABLE public.worker_shift_assignments ADD CONSTRAINT assignments_fsd_values CHECK (
  (pay_rate IS NULL OR pay_rate >= 0) AND (bill_rate IS NULL OR bill_rate >= 0)
  AND (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);
CREATE UNIQUE INDEX assignments_tenant_shift_worker_uidx ON public.worker_shift_assignments(tenant_id,shift_id,worker_id);

CREATE FUNCTION public.assert_fsd_shift_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Shift tenant cannot change' USING ERRCODE='23514';
  END IF;
  IF NEW.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=NEW.tenant_id AND id=NEW.client_id) THEN
    RAISE EXCEPTION 'Client not found in tenant' USING ERRCODE='23503';
  END IF;
  IF NEW.facility_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.facility WHERE tenant_id=NEW.tenant_id AND id=NEW.facility_id
    AND (NEW.is_internal OR NEW.client_id IS NULL OR client_id=NEW.client_id)) THEN
    RAISE EXCEPTION 'Facility not found for this tenant and client' USING ERRCODE='23503';
  END IF;
  IF NEW.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE tenant_id=NEW.tenant_id AND id=NEW.department_id) THEN
    RAISE EXCEPTION 'Department not found in tenant' USING ERRCODE='23503';
  END IF;
  IF NEW.job_category_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.job_categories WHERE tenant_id=NEW.tenant_id AND id=NEW.job_category_id) THEN
    RAISE EXCEPTION 'Job category not found in tenant' USING ERRCODE='23503';
  END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.worker_shift_assignments a WHERE a.tenant_id=NEW.tenant_id AND a.shift_id=NEW.id
    AND (NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.facility_id IS DISTINCT FROM OLD.facility_id
      OR a.start_date < NEW.start_date OR a.end_date > NEW.end_date)) THEN
    RAISE EXCEPTION 'Existing assignments conflict with the changed shift' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assert_fsd_shift_scope() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_fsd_shift_scope() TO service_role;
CREATE TRIGGER trg_fsd_shift_scope BEFORE INSERT OR UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.assert_fsd_shift_scope();

CREATE FUNCTION public.assert_fsd_assignment_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE s public.shifts%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE tenant_id=NEW.tenant_id AND id=NEW.shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found in tenant' USING ERRCODE='23503'; END IF;
  -- Legacy assignments sometimes use auth user IDs. New v1 assignments use worker IDs.
  IF NOT EXISTS(SELECT 1 FROM public.worker WHERE tenant_id=NEW.tenant_id AND (id=NEW.worker_id OR user_id=NEW.worker_id)) THEN
    RAISE EXCEPTION 'Worker not found in tenant' USING ERRCODE='23503';
  END IF;
  IF (NEW.facility_id IS NOT NULL AND NEW.facility_id IS DISTINCT FROM s.facility_id)
    OR (NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM s.client_id) THEN
    RAISE EXCEPTION 'Assignment scope differs from shift' USING ERRCODE='23514';
  END IF;
  IF (NEW.start_date IS NOT NULL AND NEW.start_date < s.start_date)
    OR (NEW.end_date IS NOT NULL AND NEW.end_date > s.end_date) THEN
    RAISE EXCEPTION 'Assignment dates fall outside shift dates' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assert_fsd_assignment_scope() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_fsd_assignment_scope() TO service_role;
CREATE TRIGGER trg_fsd_assignment_scope BEFORE INSERT OR UPDATE ON public.worker_shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.assert_fsd_assignment_scope();

CREATE FUNCTION public.assign_fsd_shift_workers(p_tenant_id uuid,p_shift_id uuid,p_worker_ids uuid[],
  p_start_date date DEFAULT NULL,p_end_date date DEFAULT NULL,p_pay_rate numeric DEFAULT NULL,p_bill_rate numeric DEFAULT NULL)
RETURNS SETOF public.worker_shift_assignments LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE s public.shifts%ROWTYPE; first_day date; last_day date;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE tenant_id=p_tenant_id AND id=p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found in tenant' USING ERRCODE='P0002'; END IF;
  IF cardinality(p_worker_ids) NOT BETWEEN 1 AND 100 OR p_worker_ids IS NULL
    OR (SELECT count(DISTINCT x) FROM unnest(p_worker_ids) x) <> cardinality(p_worker_ids) THEN
    RAISE EXCEPTION 'Provide one to one hundred distinct workers' USING ERRCODE='23514';
  END IF;
  IF (SELECT count(*) FROM public.worker WHERE tenant_id=p_tenant_id AND id=ANY(p_worker_ids)) <> cardinality(p_worker_ids) THEN
    RAISE EXCEPTION 'Worker not found in tenant' USING ERRCODE='23503';
  END IF;
  first_day := coalesce(p_start_date,s.start_date);
  last_day := coalesce(p_end_date,s.end_date,s.start_date);
  IF first_day IS NULL OR last_day < first_day OR first_day < s.start_date OR last_day > coalesce(s.end_date,s.start_date) THEN
    RAISE EXCEPTION 'Invalid assignment dates' USING ERRCODE='23514';
  END IF;
  -- Serialize assignments for the same workers even across different shifts.
  PERFORM 1 FROM public.worker WHERE tenant_id=p_tenant_id AND id=ANY(p_worker_ids) ORDER BY id FOR UPDATE;
  IF s.client_id IS NOT NULL AND NOT coalesce((SELECT enabled FROM public.tenant_effective_features
      WHERE tenant_id=p_tenant_id AND feature_key='multi_client_assignments'),false)
    AND EXISTS(SELECT 1 FROM public.worker_shift_assignments a
      JOIN public.shifts other ON other.id=a.shift_id AND other.tenant_id=p_tenant_id
      WHERE a.tenant_id=p_tenant_id AND a.worker_id=ANY(p_worker_ids)
        AND other.client_id IS NOT NULL AND other.client_id <> s.client_id
        AND a.status NOT IN ('cancelled','rejected')
        AND coalesce(a.start_date,other.start_date) <= last_day
        AND coalesce(a.end_date,other.end_date,other.start_date) >= first_day) THEN
    RAISE EXCEPTION 'Overlapping assignments across clients are disabled' USING ERRCODE='23514';
  END IF;
  RETURN QUERY INSERT INTO public.worker_shift_assignments(tenant_id,shift_id,worker_id,status,facility_id,client_id,job_role,start_date,end_date,pay_rate,bill_rate)
    SELECT p_tenant_id,p_shift_id,w.id,'confirmed',s.facility_id,s.client_id,w.job_role,first_day,last_day,p_pay_rate,p_bill_rate
    FROM public.worker w WHERE w.tenant_id=p_tenant_id AND w.id=ANY(p_worker_ids)
    RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.assign_fsd_shift_workers(uuid,uuid,uuid[],date,date,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_fsd_shift_workers(uuid,uuid,uuid[],date,date,numeric,numeric) TO service_role;

-- Mutations use server handlers so direct Data API writes cannot bypass edition/module checks.
REVOKE INSERT,UPDATE,DELETE ON public.shifts,public.worker_shift_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shifts,public.worker_shift_assignments TO service_role;

CREATE TABLE public.tenant_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 120),
  holiday_date date NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,holiday_date,name)
);
CREATE INDEX tenant_holidays_tenant_date_idx ON public.tenant_holidays(tenant_id,holiday_date);
ALTER TABLE public.tenant_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_holidays_read ON public.tenant_holidays FOR SELECT TO authenticated
USING ((SELECT public.is_god_admin_user()) OR public.user_is_tenant_staff(tenant_id));
REVOKE ALL ON public.tenant_holidays FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tenant_holidays TO authenticated;
GRANT ALL ON public.tenant_holidays TO service_role;
NOTIFY pgrst, 'reload schema';
