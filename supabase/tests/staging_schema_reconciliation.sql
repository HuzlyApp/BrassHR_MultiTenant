-- Staging reconciliation smoke checks. Fixtures and changes roll back.
BEGIN;
DO $test$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid:=gen_random_uuid();
        worker_a uuid:=gen_random_uuid(); worker_b uuid:=gen_random_uuid();
        unused_tenant uuid:=gen_random_uuid(); point_a public.geography; point_b public.geography;
BEGIN
  PERFORM set_config('test.reconcile_a',a::text,true);
  PERFORM set_config('test.reconcile_b',b::text,true);
  INSERT INTO public.tenants(id,name,slug)
    VALUES(a,'Reconcile test A','reconcile-test-'||a),(b,'Reconcile test B','reconcile-test-'||b);
  INSERT INTO auth.users(id,email,role,aud)
    VALUES(u,'reconcile-test-'||u||'@example.invalid','authenticated','authenticated');
  INSERT INTO public.users(id,tenant_id,email,role)
    VALUES(u,a,'reconcile-test-'||u||'@example.invalid','admin');
  INSERT INTO public.user_roles(user_id,tenant_id,role) VALUES(u,a,'admin');
  INSERT INTO public.worker(id,tenant_id,first_name)
    VALUES(worker_a,a,'Own worker'),(worker_b,b,'Foreign worker');
  INSERT INTO public.tenant_task_settings(tenant_id) VALUES(a),(b) ON CONFLICT (tenant_id) DO NOTHING;
  IF EXISTS(SELECT 1 FROM public.list_candidate_ids_page(p_tenant_id=>unused_tenant,p_assignee=>'unassigned'))
    OR EXISTS(SELECT 1 FROM public.list_candidate_ids_page(p_tenant_id=>unused_tenant)) THEN
    RAISE EXCEPTION 'Candidate search leaked a foreign tenant or overload is ambiguous';
  END IF;
  IF public.build_employment_worker_application_snapshot(a,gen_random_uuid())<>'{}'::jsonb
    OR public.build_employment_worker_documents_manifest(a,worker_b)<>'[]'::jsonb THEN
    RAISE EXCEPTION 'Snapshot helper leaked another tenant';
  END IF;
  IF EXISTS(SELECT 1 FROM public.match_resume_worker_ids(a,'%',1) x WHERE x.worker_id=worker_b) THEN
    RAISE EXCEPTION 'Resume search leaked a foreign worker';
  END IF;
  IF has_function_privilege('anon','public.build_employment_worker_documents_manifest(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.build_employment_worker_application_snapshot(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Internal snapshot helpers exposed to clients';
  END IF;
  point_a:=public.ST_GeogFromText('SRID=4326;POINT(-73 40)');
  point_b:=public.ST_GeogFromText('SRID=4326;POINT(-74 41)');
  IF public.ST_Distance(point_a,point_b)<=0 THEN RAISE EXCEPTION 'PostGIS not functional'; END IF;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
END;
$test$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE a uuid:=current_setting('test.reconcile_a')::uuid; b uuid:=current_setting('test.reconcile_b')::uuid;
BEGIN
  IF NOT public.staff_can_view_resource(a,'jobs') OR public.staff_can_view_resource(b,'jobs') THEN
    RAISE EXCEPTION 'Resource permission helper crossed tenant boundaries';
  END IF;
  IF (SELECT count(*) FROM public.tenant_task_settings WHERE tenant_id=a)<>1
    OR EXISTS(SELECT 1 FROM public.tenant_task_settings WHERE tenant_id=b) THEN
    RAISE EXCEPTION 'Task settings RLS tenant scope failed';
  END IF;
  UPDATE public.tenant_task_settings SET assign_only_manager_hr=false WHERE tenant_id=b;
  IF FOUND THEN RAISE EXCEPTION 'Foreign tenant task setting was modified'; END IF;
  IF EXISTS(SELECT 1 FROM public.worker WHERE tenant_id=b) THEN
    RAISE EXCEPTION 'Worker verified-reader policy leaked a foreign worker';
  END IF;
  IF has_table_privilege('anon','public.job_requisitions','SELECT')
    OR has_table_privilege('authenticated','public.worker','UPDATE') THEN
    RAISE EXCEPTION 'Main access boundaries were not restored';
  END IF;
END;
$test$;
RESET ROLE;
ROLLBACK;

