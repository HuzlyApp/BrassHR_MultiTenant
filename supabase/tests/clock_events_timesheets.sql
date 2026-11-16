-- Development regression checks; all fixtures and forced-failure triggers roll back.
BEGIN;
CREATE TEMP TABLE time_test_marker(v boolean);
CREATE FUNCTION pg_temp.fail_time_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF current_setting('test.force_time_error',true)='yes' THEN RAISE EXCEPTION 'Forced daily entry failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER zz_test_time_fail BEFORE INSERT OR UPDATE ON public.employee_timesheet_entries FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_time_entry();
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); foreign_owner uuid:=gen_random_uuid();
  candidate uuid:=gen_random_uuid(); self_candidate uuid:=gen_random_uuid(); manual_candidate uuid:=gen_random_uuid(); foreign_candidate uuid:=gen_random_uuid();
  employee uuid:=gen_random_uuid(); self_employee uuid:=gen_random_uuid(); manual_employee uuid:=gen_random_uuid(); foreign_employee uuid:=gen_random_uuid();
  foreign_client uuid:=gen_random_uuid(); foreign_facility uuid:=gen_random_uuid(); sheet public.timesheets%ROWTYPE;
  session public.applicant_attendance_logs%ROWTYPE; other_session public.applicant_attendance_logs%ROWTYPE;
  day date:=(clock_timestamp() AT TIME ZONE 'America/New_York')::date; prior_day date;
BEGIN
  PERFORM set_config('test.time_tenant',a::text,true);PERFORM set_config('test.time_foreign',b::text,true);
  INSERT INTO public.tenants(id,name,slug) VALUES(a,'Time test A','time-test-'||a),(b,'Time test B','time-test-'||b);
  INSERT INTO auth.users(id,email,role,aud) VALUES
    (owner_id,'time-test-'||owner_id||'@example.invalid','authenticated','authenticated'),
    (reviewer,'time-test-'||reviewer||'@example.invalid','authenticated','authenticated'),
    (foreign_owner,'time-test-'||foreign_owner||'@example.invalid','authenticated','authenticated');
  INSERT INTO public.users(id,tenant_id,email,role) VALUES
    (owner_id,a,'time-test-'||owner_id||'@example.invalid','worker'),(reviewer,a,'time-test-'||reviewer||'@example.invalid','admin'),
    (foreign_owner,b,'time-test-'||foreign_owner||'@example.invalid','worker');
  INSERT INTO public.user_roles(user_id,tenant_id,role) VALUES(reviewer,a,'admin');
  UPDATE public.tenant_categories SET category='SMB',edition_set_at=now() WHERE tenant_id IN(a,b);
  INSERT INTO public.worker(id,tenant_id,user_id,first_name) VALUES(candidate,a,owner_id,'Own'),(self_candidate,a,reviewer,'Self'),
    (manual_candidate,a,NULL,'Manual'),(foreign_candidate,b,foreign_owner,'Foreign');
  INSERT INTO public.workers(id,tenant_id,candidate_id,worker_type,employment_classification) VALUES
    (employee,a,candidate,'w2','employee'),(self_employee,a,self_candidate,'w2','employee'),(manual_employee,a,manual_candidate,'w2','employee'),
    (foreign_employee,b,foreign_candidate,'w2','employee');
  INSERT INTO public.clients(id,tenant_id,user_id) VALUES(foreign_client,b,foreign_owner);
  INSERT INTO public.facility(id,tenant_id,client_id,name) VALUES(foreign_facility,b,foreign_client,'Foreign');
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'denied','127.0.0.1');
    RAISE EXCEPTION 'Denied location accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.record_clock_event(a,foreign_employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Foreign employee accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    PERFORM public.record_clock_event(a,employee,foreign_owner,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Worker impersonation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'clock_in',foreign_facility,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Foreign facility accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  PERFORM set_config('test.force_time_error','yes',true);
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Expected daily-entry failure';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('test.force_time_error','no',true);
  IF EXISTS(SELECT 1 FROM public.applicant_attendance_logs WHERE tenant_id=a AND worker_id=candidate) THEN RAISE EXCEPTION 'Clock partially committed without daily entry'; END IF;
  session:=public.record_clock_event(a,employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
  SELECT * INTO sheet FROM public.timesheets WHERE tenant_id=a AND worker_id=employee AND period_start=date_trunc('week',day::timestamp)::date;
  IF sheet.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.employee_timesheet_entries WHERE tenant_id=a AND timesheet_id=sheet.id) THEN RAISE EXCEPTION 'Clock-in did not create weekly/daily time'; END IF;
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Duplicate clock-in accepted' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    PERFORM public.transition_timesheet(a,sheet.id,owner_id,'submit');
    RAISE EXCEPTION 'Open session submitted' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'break_end');
    RAISE EXCEPTION 'Break ended without starting' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  UPDATE public.applicant_attendance_logs SET clock_in_at=clock_timestamp()-interval '2 hours' WHERE tenant_id=a AND id=session.id;
  PERFORM public.record_clock_event(a,employee,owner_id,'break_start');
  UPDATE public.applicant_attendance_logs SET break_started_at=clock_timestamp()-interval '15 minutes' WHERE tenant_id=a AND id=session.id;
  session:=public.record_clock_event(a,employee,owner_id,'clock_out',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
  IF session.status<>'clocked_out' OR session.break_started_at IS NOT NULL OR session.break_seconds<899 OR jsonb_array_length(session.break_intervals)<>1 THEN
    RAISE EXCEPTION 'Clock-out did not close the active break correctly'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.employee_timesheet_entries WHERE tenant_id=a AND timesheet_id=sheet.id AND regular_minutes=105 AND break_minutes=15) THEN
    RAISE EXCEPTION 'Daily worked/break minutes incorrect'; END IF;
  PERFORM public.transition_timesheet(a,sheet.id,owner_id,'submit');
  PERFORM public.transition_timesheet(a,sheet.id,owner_id,'submit');
  BEGIN
    UPDATE public.employee_timesheet_entries SET regular_minutes=1 WHERE tenant_id=a AND timesheet_id=sheet.id;
    RAISE EXCEPTION 'Submitted entries were mutable' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    UPDATE public.applicant_attendance_logs SET total_seconds=1 WHERE tenant_id=a AND id=session.id;
    RAISE EXCEPTION 'Submitted attendance was mutable' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    PERFORM public.transition_timesheet(a,sheet.id,owner_id,'approve');
    RAISE EXCEPTION 'Worker approved their timesheet';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.tenant_role_permissions SET can_edit=false WHERE tenant_id=a AND role_key='admin' AND resource_key='scheduling';
  BEGIN
    PERFORM public.transition_timesheet(a,sheet.id,reviewer,'approve');
    RAISE EXCEPTION 'Revoked reviewer grant ignored';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.tenant_role_permissions SET can_edit=true WHERE tenant_id=a AND role_key='admin' AND resource_key='scheduling';
  BEGIN
    PERFORM public.transition_timesheet(a,sheet.id,reviewer,'reject');
    RAISE EXCEPTION 'Rejection without notes accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.transition_timesheet(a,sheet.id,reviewer,'reject','Correct the time');
  UPDATE public.employee_timesheet_entries SET regular_minutes=100,attendance_managed=false WHERE tenant_id=a AND timesheet_id=sheet.id;
  PERFORM public.transition_timesheet(a,sheet.id,owner_id,'submit');
  sheet:=public.transition_timesheet(a,sheet.id,reviewer,'approve','Reviewed');
  PERFORM public.transition_timesheet(a,sheet.id,reviewer,'approve','Retry');
  IF sheet.regular_minutes<>100 OR sheet.reviewed_by<>reviewer THEN RAISE EXCEPTION 'Approval snapshot wrong'; END IF;
  IF (SELECT count(*) FROM public.activity_logs WHERE tenant_id=a AND entity_type='timesheet' AND entity_id=sheet.id AND action='approve')<>1 THEN
    RAISE EXCEPTION 'Idempotent approval duplicated audit'; END IF;
  BEGIN
    PERFORM public.record_clock_event(a,employee,owner_id,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Approved period accepted a new clock' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    PERFORM public.transition_timesheet(b,sheet.id,foreign_owner,'submit');
    RAISE EXCEPTION 'Cross-tenant timesheet read succeeded';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  INSERT INTO public.employee_timesheet_entries(tenant_id,worker_id,work_date,regular_minutes,clock_in,clock_out)
    VALUES(a,manual_employee,day,60,'08:00','09:00');
  BEGIN
    PERFORM public.record_clock_event(a,manual_employee,reviewer,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
    RAISE EXCEPTION 'Manual time silently overwritten' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.applicant_attendance_logs WHERE tenant_id=a AND worker_id=manual_candidate) THEN RAISE EXCEPTION 'Manual conflict left a clock session'; END IF;
  other_session:=public.record_clock_event(a,self_employee,reviewer,'clock_in',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
  PERFORM public.record_clock_event(a,self_employee,reviewer,'clock_out',NULL,NULL,1,2,clock_timestamp(),'granted','127.0.0.1');
  SELECT * INTO sheet FROM public.timesheets WHERE tenant_id=a AND worker_id=self_employee AND period_start=date_trunc('week',day::timestamp)::date;
  PERFORM public.transition_timesheet(a,sheet.id,reviewer,'submit');
  BEGIN
    PERFORM public.transition_timesheet(a,sheet.id,reviewer,'approve');
    RAISE EXCEPTION 'Staff self-approval accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  prior_day:=day-8;
  INSERT INTO public.applicant_attendance_logs(tenant_id,worker_id,attendance_date,status,clock_in_at,clock_out_at,total_seconds,
    break_seconds,clock_in_ip,clock_in_latitude,clock_in_longitude,clock_in_location_timestamp,clock_in_location_permission_status)
    VALUES(a,candidate,prior_day,'clocked_out',(prior_day::timestamp+interval '8 hours') AT TIME ZONE 'America/New_York',
      (prior_day::timestamp+interval '17 hours 30 minutes') AT TIME ZONE 'America/New_York',32400,1800,'127.0.0.1',1,2,clock_timestamp(),'granted');
  IF NOT EXISTS(SELECT 1 FROM public.employee_timesheet_entries WHERE tenant_id=a AND worker_id=employee AND work_date=prior_day AND regular_minutes=480 AND overtime_minutes=60 AND break_minutes=30) THEN
    RAISE EXCEPTION 'Existing daily regular/overtime split changed'; END IF;
  IF (public.summarize_period_timesheets(a,day-14,day+6,ARRAY[employee],employee)->>'regular_minutes')::int<>580
    OR (public.summarize_period_timesheets(a,day-14,day+6,ARRAY[foreign_employee])->>'workers')::int<>0 THEN
    RAISE EXCEPTION 'Period summary or owned-worker filtering is incorrect'; END IF;
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.timesheets','SELECT') OR has_table_privilege('authenticated','public.employee_timesheet_entries','UPDATE')
    OR has_table_privilege('authenticated','public.applicant_attendance_logs','INSERT') THEN RAISE EXCEPTION 'Direct API bypass of time workflow'; END IF;
  IF has_function_privilege('authenticated','public.transition_timesheet(uuid,uuid,uuid,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.record_clock_event(uuid,uuid,uuid,text,uuid,uuid,numeric,numeric,timestamp with time zone,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Time RPC exposed to API clients'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
