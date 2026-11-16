-- Use the existing activity_logs schema, as lib/audit/activity-log.ts does.
-- Keep workflow writes and their tenant-scoped audit rows in the same transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.record_clock_event(p_tenant uuid, p_employee uuid, p_actor uuid, p_action text, p_facility uuid DEFAULT NULL::uuid, p_shift uuid DEFAULT NULL::uuid, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric, p_location_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_permission text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS applicant_attendance_logs
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  INSERT INTO public.activity_logs(tenant_id,user_id,action,entity_type,entity_id,details)
    VALUES(p_tenant,p_actor,p_action,'attendance',result.id,jsonb_build_object('tenant_id',p_tenant,'worker_id',p_employee));
  RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.transition_timesheet(p_tenant uuid, p_sheet uuid, p_actor uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS timesheets
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  INSERT INTO public.activity_logs(tenant_id,user_id,action,entity_type,entity_id,details) VALUES(p_tenant,p_actor,p_action,'timesheet',p_sheet,
    jsonb_build_object('tenant_id',p_tenant,'notes',p_notes,'regular_minutes',sheet.regular_minutes,'overtime_minutes',sheet.overtime_minutes));
  RETURN sheet;
END $function$;

COMMIT;

