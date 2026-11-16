-- Development-only regression script; every fixture and test trigger rolls back.
BEGIN;
CREATE TEMP TABLE worker_request_test_marker(value boolean);
CREATE FUNCTION pg_temp.force_request_leave_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notes='__request_test_fail__' THEN RAISE EXCEPTION 'Forced leave failure' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER request_test_fail BEFORE INSERT ON public.worker_time_off
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_request_leave_failure();
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid();
  owner_id uuid:=gen_random_uuid(); foreign_owner uuid:=gen_random_uuid();
  w uuid:=gen_random_uuid(); self_worker uuid:=gen_random_uuid(); foreign_worker uuid:=gen_random_uuid();
  r uuid:=gen_random_uuid(); rejected uuid:=gen_random_uuid(); other_request uuid:=gen_random_uuid();
  failed uuid:=gen_random_uuid(); foreign_request uuid:=gen_random_uuid(); self_request uuid:=gen_random_uuid();
  foreign_dept uuid:=gen_random_uuid(); reviewed public.worker_requests%ROWTYPE;
BEGIN
  PERFORM set_config('test.requests_tenant',a::text,true);
  PERFORM set_config('test.requests_foreign',b::text,true);
  PERFORM set_config('test.requests_owner',owner_id::text,true);
  INSERT INTO public.tenants(id,name,slug) VALUES(a,'Request test A','request-test-'||a),(b,'Request test B','request-test-'||b);
  INSERT INTO auth.users(id,email,role,aud) VALUES
    (reviewer,'request-test-'||reviewer||'@example.invalid','authenticated','authenticated'),
    (owner_id,'request-test-'||owner_id||'@example.invalid','authenticated','authenticated'),
    (foreign_owner,'request-test-'||foreign_owner||'@example.invalid','authenticated','authenticated');
  INSERT INTO public.users(id,tenant_id,email,role) VALUES
    (reviewer,a,'request-test-'||reviewer||'@example.invalid','admin'),
    (owner_id,a,'request-test-'||owner_id||'@example.invalid','worker'),
    (foreign_owner,b,'request-test-'||foreign_owner||'@example.invalid','worker');
  INSERT INTO public.user_roles(user_id,tenant_id,role) VALUES(reviewer,a,'admin');
  UPDATE public.tenant_categories SET category='SMB',edition_set_at=now() WHERE tenant_id IN(a,b);
  INSERT INTO public.worker(id,tenant_id,user_id,first_name) VALUES
    (w,a,owner_id,'Own worker'),(self_worker,a,reviewer,'Reviewer worker'),(foreign_worker,b,foreign_owner,'Foreign worker');
  INSERT INTO public.departments(id,tenant_id,name) VALUES(foreign_dept,b,'Foreign');
  BEGIN
    INSERT INTO public.worker_requests(tenant_id,worker_id,request_type,start_date,end_date,reason,off_type,created_by)
      VALUES(a,foreign_worker,'time_off','2026-11-20','2026-11-21','Invalid','Vacation',reviewer);
    RAISE EXCEPTION 'Cross-tenant worker accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.worker_requests(tenant_id,worker_id,request_type,start_date,end_date,reason,off_type,department_id,created_by)
      VALUES(a,w,'time_off','2026-11-20','2026-11-21','Invalid','Vacation',foreign_dept,reviewer);
    RAISE EXCEPTION 'Cross-tenant department accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  INSERT INTO public.worker_requests(id,tenant_id,worker_id,request_type,start_date,end_date,reason,off_type,created_by) VALUES
    (r,a,w,'time_off','2026-11-20','2026-11-21','Approved leave','Vacation',owner_id),
    (rejected,a,w,'time_off','2026-11-22','2026-11-23','Rejected leave','Vacation',owner_id),
    (foreign_request,b,foreign_worker,'time_off','2026-11-20','2026-11-21','Foreign leave','Vacation',foreign_owner),
    (self_request,a,self_worker,'time_off','2026-11-20','2026-11-21','Self leave','Vacation',reviewer);
  INSERT INTO public.worker_requests(id,tenant_id,worker_id,request_type,start_date,end_date,reason,notes,off_type,created_by)
    VALUES(failed,a,w,'time_off','2026-11-24','2026-11-25','Atomicity test','__request_test_fail__','Vacation',owner_id);
  INSERT INTO public.worker_requests(id,tenant_id,worker_id,request_type,start_date,end_date,reason,created_by)
    VALUES(other_request,a,w,'schedule_change','2026-11-20','2026-11-21','Schedule request',owner_id);
  IF EXISTS(SELECT 1 FROM public.worker_time_off WHERE tenant_id=a) THEN RAISE EXCEPTION 'Pending requests created leave'; END IF;
  BEGIN
    PERFORM public.review_worker_request(a,r,owner_id,'approved');
    RAISE EXCEPTION 'Unprivileged worker reviewed request';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.review_worker_request(a,foreign_request,reviewer,'approved');
    RAISE EXCEPTION 'Foreign request was reviewed';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  BEGIN
    PERFORM public.review_worker_request(a,self_request,reviewer,'approved');
    RAISE EXCEPTION 'Self approval was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.tenant_role_permissions SET can_edit=false WHERE tenant_id=a AND role_key='admin' AND resource_key='scheduling';
  BEGIN
    PERFORM public.review_worker_request(a,r,reviewer,'approved');
    RAISE EXCEPTION 'Revoked grant was ignored';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.tenant_role_permissions SET can_edit=true WHERE tenant_id=a AND role_key='admin' AND resource_key='scheduling';
  UPDATE public.user_roles SET is_active=false WHERE tenant_id=a AND user_id=reviewer;
  BEGIN
    PERFORM public.review_worker_request(a,r,reviewer,'approved');
    RAISE EXCEPTION 'Suspended membership was ignored';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.user_roles SET is_active=true WHERE tenant_id=a AND user_id=reviewer;
  reviewed:=public.review_worker_request(a,r,reviewer,'approved','Approved by reviewer');
  IF reviewed.status<>'approved' OR reviewed.reviewed_by<>reviewer OR reviewed.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Review audit fields missing'; END IF;
  PERFORM public.review_worker_request(a,r,reviewer,'approved','Retry must preserve original review');
  IF (SELECT count(*) FROM public.worker_time_off WHERE tenant_id=a AND source_request_id=r)<>1 THEN RAISE EXCEPTION 'Approval duplicated leave'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.worker_time_off WHERE tenant_id=a AND source_request_id=r AND worker_id=w
      AND start_date<='2026-11-30' AND end_date>='2026-11-01') THEN RAISE EXCEPTION 'Approved request absent from schedule leave source'; END IF;
  IF (SELECT review_notes FROM public.worker_requests WHERE tenant_id=a AND id=r)<>'Approved by reviewer' THEN RAISE EXCEPTION 'Idempotent retry rewrote audit'; END IF;
  PERFORM public.review_worker_request(a,rejected,reviewer,'rejected','Not approved');
  PERFORM public.review_worker_request(a,other_request,reviewer,'approved');
  IF EXISTS(SELECT 1 FROM public.worker_time_off WHERE tenant_id=a AND source_request_id IN(rejected,other_request)) THEN
    RAISE EXCEPTION 'Rejected or non-time-off request created leave'; END IF;
  BEGIN
    PERFORM public.review_worker_request(a,rejected,reviewer,'approved');
    RAISE EXCEPTION 'Rejection was reversed' USING ERRCODE='23514';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    PERFORM public.review_worker_request(a,failed,reviewer,'approved');
    RAISE EXCEPTION 'Forced leave insertion failure did not occur';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF NOT EXISTS(SELECT 1 FROM public.worker_requests WHERE tenant_id=a AND id=failed AND status='pending' AND reviewed_by IS NULL)
    OR EXISTS(SELECT 1 FROM public.worker_time_off WHERE tenant_id=a AND source_request_id=failed) THEN
    RAISE EXCEPTION 'Leave insertion failure partially committed approval'; END IF;
  BEGIN
    UPDATE public.worker_time_off SET start_date='2026-11-19' WHERE tenant_id=a AND source_request_id=r;
    RAISE EXCEPTION 'Linked leave was detached from request dates';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',reviewer::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.worker_requests','SELECT')
    OR has_table_privilege('authenticated','public.worker_requests','INSERT')
    OR has_table_privilege('authenticated','public.worker_time_off','UPDATE') THEN
    RAISE EXCEPTION 'Direct Data API access bypasses scoped server handlers'; END IF;
  IF has_function_privilege('authenticated','public.review_worker_request(uuid,uuid,uuid,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.review_worker_request(uuid,uuid,uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Review RPC exposed to API clients'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
