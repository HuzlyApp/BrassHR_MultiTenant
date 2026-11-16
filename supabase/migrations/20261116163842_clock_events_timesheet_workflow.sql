-- Keep existing attendance sessions and employee daily entries as the time source.
ALTER TABLE public.applicant_attendance_logs
  ADD COLUMN IF NOT EXISTS break_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS break_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_intervals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN facility_id uuid REFERENCES public.facility(id),
  ADD COLUMN department_id uuid REFERENCES public.departments(id),
  ADD COLUMN shift_id uuid REFERENCES public.shifts(id);
CREATE INDEX attendance_facility_idx ON public.applicant_attendance_logs(facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX attendance_department_idx ON public.applicant_attendance_logs(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX attendance_shift_idx ON public.applicant_attendance_logs(shift_id) WHERE shift_id IS NOT NULL;

CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  worker_id uuid NOT NULL REFERENCES public.workers(id),
  period_start date NOT NULL CHECK(extract(isodow FROM period_start)=1),
  period_end date NOT NULL CHECK(period_end=period_start+6),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  regular_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  break_minutes integer NOT NULL DEFAULT 0,
  submitted_by uuid REFERENCES auth.users(id), submitted_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id), reviewed_at timestamptz, review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,worker_id,period_start), UNIQUE(tenant_id,id)
);
CREATE INDEX timesheets_tenant_period_idx ON public.timesheets(tenant_id,period_start,status);
CREATE INDEX timesheets_worker_idx ON public.timesheets(worker_id);
CREATE INDEX timesheets_submitter_idx ON public.timesheets(submitted_by) WHERE submitted_by IS NOT NULL;
CREATE INDEX timesheets_reviewer_idx ON public.timesheets(reviewed_by) WHERE reviewed_by IS NOT NULL;
ALTER TABLE public.employee_timesheet_entries ADD COLUMN timesheet_id uuid;
ALTER TABLE public.employee_timesheet_entries ADD COLUMN attendance_managed boolean NOT NULL DEFAULT false;
ALTER TABLE public.employee_timesheet_entries ADD CONSTRAINT employee_entry_sheet_tenant_fk
  FOREIGN KEY(tenant_id,timesheet_id) REFERENCES public.timesheets(tenant_id,id);
CREATE INDEX employee_entry_sheet_idx ON public.employee_timesheet_entries(tenant_id,timesheet_id);

CREATE FUNCTION public.time_actor_can_manage(p_tenant uuid,p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u LEFT JOIN public.user_roles ur ON ur.user_id=u.id AND ur.tenant_id=p_tenant
    WHERE u.id=p_actor AND u.is_active AND NOT u.must_change_password AND
      (u.god_admin OR ((ur.is_active OR (ur.user_id IS NULL AND u.tenant_id=p_tenant)) AND EXISTS(
        SELECT 1 FROM public.tenant_role_permissions rp JOIN public.tenant_roles tr ON tr.tenant_id=rp.tenant_id AND tr.role_key=rp.role_key
        WHERE rp.tenant_id=p_tenant AND tr.tenant_id=p_tenant AND rp.resource_key='scheduling' AND rp.can_edit
          AND (tr.role_key=coalesce(ur.role,u.role) OR EXISTS(SELECT 1 FROM public.staff_roles sr
            WHERE sr.is_active AND sr.is_staff AND sr.key=tr.role_key
              AND (sr.storage_key=coalesce(ur.role,u.role) OR coalesce(ur.role,u.role)=ANY(sr.aliases))))
      ))));
$$;

CREATE FUNCTION public.guard_timesheet_entry() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r public.employee_timesheet_entries%ROWTYPE; candidate uuid; first_day date; sheet public.timesheets%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  IF TG_OP='UPDATE' AND ROW(NEW.tenant_id,NEW.worker_id,NEW.work_date) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.worker_id,OLD.work_date) THEN
    RAISE EXCEPTION 'Entry identity cannot change' USING ERRCODE='23514';
  END IF;
  SELECT candidate_id INTO candidate FROM public.workers WHERE tenant_id=r.tenant_id AND id=r.worker_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in tenant' USING ERRCODE='23503'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.tenant_id::text||candidate::text,921));
  first_day:=date_trunc('week',r.work_date::timestamp)::date;
  INSERT INTO public.timesheets(tenant_id,worker_id,period_start,period_end) VALUES(r.tenant_id,r.worker_id,first_day,first_day+6)
    ON CONFLICT(tenant_id,worker_id,period_start) DO NOTHING;
  SELECT * INTO sheet FROM public.timesheets WHERE tenant_id=r.tenant_id AND worker_id=r.worker_id AND period_start=first_day FOR UPDATE;
  IF sheet.status IN ('submitted','approved') THEN RAISE EXCEPTION 'Timesheet is locked' USING ERRCODE='P0001'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  NEW.timesheet_id:=sheet.id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_timesheet_entry BEFORE INSERT OR UPDATE OR DELETE ON public.employee_timesheet_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_timesheet_entry();

CREATE FUNCTION public.refresh_timesheet_totals() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE scope_tenant uuid; scope_sheet uuid;
BEGIN
  IF TG_OP='DELETE' THEN scope_tenant:=OLD.tenant_id; scope_sheet:=OLD.timesheet_id;
  ELSE scope_tenant:=NEW.tenant_id; scope_sheet:=NEW.timesheet_id; END IF;
  UPDATE public.timesheets SET regular_minutes=(SELECT coalesce(sum(regular_minutes),0) FROM public.employee_timesheet_entries WHERE tenant_id=scope_tenant AND timesheet_id=scope_sheet),
    overtime_minutes=(SELECT coalesce(sum(overtime_minutes),0) FROM public.employee_timesheet_entries WHERE tenant_id=scope_tenant AND timesheet_id=scope_sheet),
    break_minutes=(SELECT coalesce(sum(break_minutes),0) FROM public.employee_timesheet_entries WHERE tenant_id=scope_tenant AND timesheet_id=scope_sheet),updated_at=now()
    WHERE tenant_id=scope_tenant AND id=scope_sheet;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_refresh_timesheet_totals AFTER INSERT OR UPDATE OR DELETE ON public.employee_timesheet_entries
FOR EACH ROW EXECUTE FUNCTION public.refresh_timesheet_totals();

CREATE FUNCTION public.sync_attendance_timesheet_day(p_tenant uuid,p_candidate uuid,p_day date)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE employee uuid; worked integer; breaks integer; first_in timestamptz; last_out timestamptz;
  open_session boolean; f uuid; d uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||p_candidate::text,921));
  SELECT id INTO employee FROM public.workers WHERE tenant_id=p_tenant AND candidate_id=p_candidate;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT least(1440,greatest(0,round(sum(CASE WHEN status='clocked_out' AND total_seconds IS NOT NULL THEN total_seconds
      ELSE greatest(0,extract(epoch FROM (coalesce(clock_out_at,clock_timestamp())-clock_in_at))-coalesce(break_seconds,0)
        -CASE WHEN break_started_at IS NOT NULL THEN greatest(0,extract(epoch FROM(clock_timestamp()-break_started_at))) ELSE 0 END) END)/60.0)))::int,
    least(1440,greatest(0,round(sum(coalesce(break_seconds,0)+CASE WHEN break_started_at IS NOT NULL THEN greatest(0,extract(epoch FROM(clock_timestamp()-break_started_at))) ELSE 0 END)/60.0)))::int,
    min(clock_in_at),max(clock_out_at),bool_or(status='clocked_in')
    INTO worked,breaks,first_in,last_out,open_session FROM public.applicant_attendance_logs
    WHERE tenant_id=p_tenant AND worker_id=p_candidate AND attendance_date=p_day;
  IF first_in IS NULL THEN RETURN false; END IF;
  SELECT facility_id,department_id INTO f,d FROM public.applicant_attendance_logs
    WHERE tenant_id=p_tenant AND worker_id=p_candidate AND attendance_date=p_day ORDER BY clock_in_at,id LIMIT 1;
  IF f IS NULL AND d IS NULL THEN
    SELECT facility_id,department_id INTO f,d FROM public.employee_schedule_shifts
      WHERE tenant_id=p_tenant AND worker_id=employee AND work_date=p_day ORDER BY start_time,id LIMIT 1;
  END IF;
  INSERT INTO public.employee_timesheet_entries(tenant_id,worker_id,facility_id,department_id,work_date,regular_minutes,overtime_minutes,break_minutes,clock_in,clock_out,attendance_managed)
    VALUES(p_tenant,employee,f,d,p_day,least(480,worked),greatest(0,worked-480),breaks,
      (first_in AT TIME ZONE 'America/New_York')::time,CASE WHEN open_session THEN NULL ELSE (last_out AT TIME ZONE 'America/New_York')::time END,true)
    ON CONFLICT(worker_id,work_date) DO UPDATE SET facility_id=excluded.facility_id,department_id=excluded.department_id,
      regular_minutes=excluded.regular_minutes,overtime_minutes=excluded.overtime_minutes,break_minutes=excluded.break_minutes,
      clock_in=excluded.clock_in,clock_out=excluded.clock_out,updated_at=now()
    WHERE public.employee_timesheet_entries.tenant_id=p_tenant AND public.employee_timesheet_entries.attendance_managed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reconcile the existing manual daily entry before clocking' USING ERRCODE='P0001'; END IF;
  RETURN true;
END $$;

CREATE FUNCTION public.guard_attendance_timesheet() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE employee uuid; first_day date;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.tenant_id,NEW.worker_id,NEW.attendance_date) IS DISTINCT FROM ROW(OLD.tenant_id,OLD.worker_id,OLD.attendance_date) THEN
    RAISE EXCEPTION 'Attendance identity cannot change' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.worker WHERE tenant_id=NEW.tenant_id AND id=NEW.worker_id) THEN
    RAISE EXCEPTION 'Worker not found in tenant' USING ERRCODE='23503'; END IF;
  IF NEW.facility_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.facility WHERE tenant_id=NEW.tenant_id AND id=NEW.facility_id) THEN
    RAISE EXCEPTION 'Facility not found in tenant' USING ERRCODE='23503'; END IF;
  IF NEW.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE tenant_id=NEW.tenant_id AND id=NEW.department_id) THEN
    RAISE EXCEPTION 'Department not found in tenant' USING ERRCODE='23503'; END IF;
  IF NEW.shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shifts WHERE tenant_id=NEW.tenant_id AND id=NEW.shift_id) THEN
    RAISE EXCEPTION 'Shift not found in tenant' USING ERRCODE='23503'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.tenant_id::text||NEW.worker_id::text,921));
  SELECT id INTO employee FROM public.workers WHERE tenant_id=NEW.tenant_id AND candidate_id=NEW.worker_id;
  first_day:=date_trunc('week',NEW.attendance_date::timestamp)::date;
  IF EXISTS(SELECT 1 FROM public.timesheets WHERE tenant_id=NEW.tenant_id AND worker_id=employee AND period_start=first_day AND status IN ('submitted','approved')) THEN
    RAISE EXCEPTION 'Timesheet is locked' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_attendance_timesheet BEFORE INSERT OR UPDATE OF status,clock_in_at,clock_out_at,total_seconds,
  break_started_at,break_seconds,break_intervals,facility_id,department_id,shift_id,worker_id,tenant_id,attendance_date
  ON public.applicant_attendance_logs FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_timesheet();
CREATE FUNCTION public.sync_attendance_timesheet_trigger() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM public.sync_attendance_timesheet_day(NEW.tenant_id,NEW.worker_id,NEW.attendance_date); RETURN NULL; END $$;
CREATE TRIGGER trg_sync_attendance_timesheet AFTER INSERT OR UPDATE OF status,clock_in_at,clock_out_at,total_seconds,
  break_started_at,break_seconds,break_intervals,facility_id,department_id,shift_id
  ON public.applicant_attendance_logs FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_timesheet_trigger();

CREATE FUNCTION public.record_clock_event(p_tenant uuid,p_employee uuid,p_actor uuid,p_action text,
  p_facility uuid DEFAULT NULL,p_shift uuid DEFAULT NULL,p_lat numeric DEFAULT NULL,p_lng numeric DEFAULT NULL,
  p_location_at timestamptz DEFAULT NULL,p_permission text DEFAULT NULL,p_ip text DEFAULT NULL)
RETURNS public.applicant_attendance_logs LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE candidate uuid; owner_id uuid; d uuid; f uuid:=p_facility; at_time timestamptz:=clock_timestamp();
  session public.applicant_attendance_logs%ROWTYPE; result public.applicant_attendance_logs%ROWTYPE; first_session public.applicant_attendance_logs%ROWTYPE;
  day date; break_total integer; intervals jsonb;
BEGIN
  IF NOT coalesce((SELECT enabled FROM public.tenant_effective_features WHERE tenant_id=p_tenant AND feature_key='timesheets'),false) THEN
    RAISE EXCEPTION 'Timesheets disabled or edition unclassified' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND NOT is_active)
    OR EXISTS(SELECT 1 FROM public.user_roles WHERE tenant_id=p_tenant AND user_id=p_actor AND NOT is_active) THEN
    RAISE EXCEPTION 'Account or membership disabled' USING ERRCODE='42501'; END IF;
  SELECT w.candidate_id,c.user_id,c.department_id INTO candidate,owner_id,d FROM public.workers w
    JOIN public.worker c ON c.id=w.candidate_id AND c.tenant_id=p_tenant
    WHERE w.tenant_id=p_tenant AND w.id=p_employee AND w.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in tenant' USING ERRCODE='P0002'; END IF;
  IF owner_id IS DISTINCT FROM p_actor AND NOT public.time_actor_can_manage(p_tenant,p_actor) THEN
    RAISE EXCEPTION 'Clock permission required' USING ERRCODE='42501'; END IF;
  IF p_action NOT IN ('clock_in','clock_out','break_start','break_end') OR p_action IS NULL THEN
    RAISE EXCEPTION 'Invalid clock action' USING ERRCODE='23514'; END IF;
  IF p_action IN ('clock_in','clock_out') AND (p_permission IS DISTINCT FROM 'granted' OR p_lat IS NULL OR p_lng IS NULL
      OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_location_at IS NULL OR nullif(btrim(p_ip),'') IS NULL) THEN
    RAISE EXCEPTION 'Location permission and network information required' USING ERRCODE='23514'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||candidate::text,921));
  at_time:=clock_timestamp();
  SELECT * INTO session FROM public.applicant_attendance_logs WHERE tenant_id=p_tenant AND worker_id=candidate AND status='clocked_in' FOR UPDATE;
  IF p_action='clock_in' THEN
    IF session.id IS NOT NULL THEN RAISE EXCEPTION 'Already clocked in' USING ERRCODE='P0001'; END IF;
    day:=(at_time AT TIME ZONE 'America/New_York')::date;
    IF p_shift IS NOT NULL THEN
      SELECT facility_id,department_id INTO f,d FROM public.shifts WHERE tenant_id=p_tenant AND id=p_shift AND start_date<=day AND coalesce(end_date,start_date)>=day;
      IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.worker_shift_assignments WHERE tenant_id=p_tenant AND shift_id=p_shift
        AND worker_id IN(candidate,owner_id) AND status NOT IN ('cancelled','rejected')) THEN
        RAISE EXCEPTION 'Shift not assigned to worker in this tenant' USING ERRCODE='23503'; END IF;
      IF p_facility IS NOT NULL AND p_facility IS DISTINCT FROM f THEN RAISE EXCEPTION 'Facility differs from shift' USING ERRCODE='23514'; END IF;
    ELSIF f IS NULL THEN
      SELECT facility_id,department_id INTO f,d FROM public.employee_schedule_shifts WHERE tenant_id=p_tenant AND worker_id=p_employee AND work_date=day ORDER BY start_time,id LIMIT 1;
    END IF;
    SELECT * INTO first_session FROM public.applicant_attendance_logs WHERE tenant_id=p_tenant AND worker_id=candidate AND attendance_date=day ORDER BY clock_in_at,id LIMIT 1;
    IF first_session.id IS NOT NULL AND first_session.facility_id IS DISTINCT FROM f THEN
      RAISE EXCEPTION 'One daily facility is supported by the existing daily entry model' USING ERRCODE='P0001'; END IF;
    INSERT INTO public.applicant_attendance_logs(tenant_id,worker_id,attendance_date,status,clock_in_at,clock_in_ip,
      clock_in_latitude,clock_in_longitude,clock_in_location_timestamp,clock_in_location_permission_status,facility_id,department_id,shift_id)
      VALUES(p_tenant,candidate,day,'clocked_in',at_time,p_ip,p_lat,p_lng,p_location_at,'granted',f,d,p_shift) RETURNING * INTO result;
  ELSE
    IF session.id IS NULL THEN RAISE EXCEPTION 'Clock in first' USING ERRCODE='P0001'; END IF;
    IF p_facility IS NOT NULL AND p_facility IS DISTINCT FROM session.facility_id OR p_shift IS NOT NULL AND p_shift IS DISTINCT FROM session.shift_id THEN
      RAISE EXCEPTION 'Clock scope differs from active session' USING ERRCODE='23514'; END IF;
    IF p_action='break_start' THEN
      IF session.break_started_at IS NOT NULL THEN RAISE EXCEPTION 'Already on break' USING ERRCODE='P0001'; END IF;
      UPDATE public.applicant_attendance_logs SET break_started_at=at_time WHERE tenant_id=p_tenant AND id=session.id RETURNING * INTO result;
    ELSE
      IF p_action='break_end' AND session.break_started_at IS NULL THEN RAISE EXCEPTION 'Not on break' USING ERRCODE='P0001'; END IF;
      break_total:=coalesce(session.break_seconds,0); intervals:=coalesce(session.break_intervals,'[]'::jsonb);
      IF session.break_started_at IS NOT NULL THEN
        break_total:=break_total+greatest(0,round(extract(epoch FROM(at_time-session.break_started_at))))::int;
        intervals:=intervals||jsonb_build_array(jsonb_build_object('started_at',session.break_started_at,'ended_at',at_time));
      END IF;
      UPDATE public.applicant_attendance_logs SET break_started_at=NULL,break_seconds=break_total,break_intervals=intervals,
        status=CASE WHEN p_action='clock_out' THEN 'clocked_out' ELSE status END,
        clock_out_at=CASE WHEN p_action='clock_out' THEN at_time ELSE clock_out_at END,
        total_seconds=CASE WHEN p_action='clock_out' THEN greatest(0,round(extract(epoch FROM(at_time-clock_in_at)))::int-break_total) ELSE total_seconds END,
        clock_out_ip=CASE WHEN p_action='clock_out' THEN p_ip ELSE clock_out_ip END,
        clock_out_latitude=CASE WHEN p_action='clock_out' THEN p_lat ELSE clock_out_latitude END,
        clock_out_longitude=CASE WHEN p_action='clock_out' THEN p_lng ELSE clock_out_longitude END,
        clock_out_location_timestamp=CASE WHEN p_action='clock_out' THEN p_location_at ELSE clock_out_location_timestamp END,
        clock_out_location_permission_status=CASE WHEN p_action='clock_out' THEN 'granted' ELSE clock_out_location_permission_status END,updated_at=at_time
        WHERE tenant_id=p_tenant AND id=session.id RETURNING * INTO result;
    END IF;
  END IF;
  INSERT INTO public.activity_log(actor_user_id,action,entity_type,entity_id,metadata)
    VALUES(p_actor,p_action,'attendance',result.id::text,jsonb_build_object('tenant_id',p_tenant,'worker_id',p_employee));
  RETURN result;
END $$;

CREATE FUNCTION public.transition_timesheet(p_tenant uuid,p_sheet uuid,p_actor uuid,p_action text,p_notes text DEFAULT NULL)
RETURNS public.timesheets LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE sheet public.timesheets%ROWTYPE; candidate uuid; owner_id uuid;
BEGIN
  IF NOT coalesce((SELECT enabled FROM public.tenant_effective_features WHERE tenant_id=p_tenant AND feature_key='timesheets'),false) THEN
    RAISE EXCEPTION 'Timesheets disabled or edition unclassified' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND NOT is_active)
    OR EXISTS(SELECT 1 FROM public.user_roles WHERE tenant_id=p_tenant AND user_id=p_actor AND NOT is_active) THEN
    RAISE EXCEPTION 'Account or membership disabled' USING ERRCODE='42501'; END IF;
  SELECT * INTO sheet FROM public.timesheets WHERE tenant_id=p_tenant AND id=p_sheet;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet not found in tenant' USING ERRCODE='P0002'; END IF;
  SELECT w.candidate_id,c.user_id INTO candidate,owner_id FROM public.workers w JOIN public.worker c ON c.tenant_id=p_tenant AND c.id=w.candidate_id
    WHERE w.tenant_id=p_tenant AND w.id=sheet.worker_id;
  IF p_action='submit' THEN
    IF owner_id IS DISTINCT FROM p_actor AND NOT public.time_actor_can_manage(p_tenant,p_actor) THEN RAISE EXCEPTION 'Submit permission required' USING ERRCODE='42501'; END IF;
  ELSIF p_action IN ('approve','reject') THEN
    IF owner_id=p_actor OR NOT public.time_actor_can_manage(p_tenant,p_actor) THEN RAISE EXCEPTION 'Another authorized reviewer required' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Invalid timesheet action' USING ERRCODE='23514'; END IF;
  IF char_length(p_notes)>4000 OR p_action='reject' AND nullif(btrim(p_notes),'') IS NULL THEN RAISE EXCEPTION 'Rejection notes required' USING ERRCODE='23514'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant::text||candidate::text,921));
  SELECT * INTO sheet FROM public.timesheets WHERE tenant_id=p_tenant AND id=p_sheet FOR UPDATE;
  IF p_action='submit' AND sheet.status='submitted' OR p_action='approve' AND sheet.status='approved' OR p_action='reject' AND sheet.status='rejected' THEN RETURN sheet; END IF;
  IF p_action='submit' THEN
    IF sheet.status NOT IN ('draft','rejected') OR EXISTS(SELECT 1 FROM public.applicant_attendance_logs WHERE tenant_id=p_tenant AND worker_id=candidate
      AND attendance_date BETWEEN sheet.period_start AND sheet.period_end AND status='clocked_in')
      OR NOT EXISTS(SELECT 1 FROM public.employee_timesheet_entries WHERE tenant_id=p_tenant AND timesheet_id=p_sheet)
      OR EXISTS(SELECT 1 FROM public.employee_timesheet_entries WHERE tenant_id=p_tenant AND timesheet_id=p_sheet AND clock_in IS NOT NULL AND clock_out IS NULL) THEN
      RAISE EXCEPTION 'Complete and close all time entries before submission' USING ERRCODE='P0001'; END IF;
    UPDATE public.timesheets SET status='submitted',submitted_by=p_actor,submitted_at=now(),reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL,updated_at=now()
      WHERE tenant_id=p_tenant AND id=p_sheet RETURNING * INTO sheet;
  ELSE
    IF sheet.status<>'submitted' THEN RAISE EXCEPTION 'Submit the timesheet before review' USING ERRCODE='P0001'; END IF;
    UPDATE public.timesheets SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,
      reviewed_by=p_actor,reviewed_at=now(),review_notes=p_notes,updated_at=now() WHERE tenant_id=p_tenant AND id=p_sheet RETURNING * INTO sheet;
  END IF;
  INSERT INTO public.activity_log(actor_user_id,action,entity_type,entity_id,metadata) VALUES(p_actor,p_action,'timesheet',p_sheet::text,
    jsonb_build_object('tenant_id',p_tenant,'notes',p_notes,'regular_minutes',sheet.regular_minutes,'overtime_minutes',sheet.overtime_minutes));
  RETURN sheet;
END $$;

-- Attach existing daily entries without changing their recorded minutes.
CREATE FUNCTION public.summarize_period_timesheets(p_tenant uuid,p_start date,p_end date,p_owned uuid[] DEFAULT NULL,
  p_worker uuid DEFAULT NULL,p_facility uuid DEFAULT NULL,p_department uuid DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('regular_minutes',coalesce(sum(e.regular_minutes),0),'overtime_minutes',coalesce(sum(e.overtime_minutes),0),
    'break_minutes',coalesce(sum(e.break_minutes),0),'total_hours',round(coalesce(sum(e.regular_minutes+e.overtime_minutes),0)/60.0,2),
    'timesheets',count(DISTINCT t.id),'workers',count(DISTINCT t.worker_id))
  FROM public.timesheets t LEFT JOIN public.employee_timesheet_entries e ON e.tenant_id=p_tenant AND e.timesheet_id=t.id AND e.work_date BETWEEN p_start AND p_end
  WHERE t.tenant_id=p_tenant AND t.period_start<=p_end AND t.period_end>=p_start
    AND (p_owned IS NULL OR t.worker_id=ANY(p_owned)) AND (p_worker IS NULL OR t.worker_id=p_worker)
    AND (p_facility IS NULL OR e.facility_id=p_facility) AND (p_department IS NULL OR e.department_id=p_department)
    AND (p_status IS NULL OR t.status=p_status);
$$;
UPDATE public.employee_timesheet_entries SET timesheet_id=timesheet_id WHERE timesheet_id IS NULL;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY timesheets_server_only ON public.timesheets FOR SELECT TO authenticated USING(false);
REVOKE ALL ON public.timesheets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.timesheets TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.employee_timesheet_entries,public.applicant_attendance_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.employee_timesheet_entries,public.applicant_attendance_logs TO service_role;
DO $$ DECLARE fn record; BEGIN
  FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY['time_actor_can_manage','guard_timesheet_entry','refresh_timesheet_totals',
      'sync_attendance_timesheet_day','guard_attendance_timesheet','sync_attendance_timesheet_trigger','record_clock_event','transition_timesheet','summarize_period_timesheets']) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
