-- Development integration checks. All fixtures are rolled back.
BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid:=gen_random_uuid();
  v uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  c2 uuid:=gen_random_uuid(); foreign_client uuid:=gen_random_uuid();
  w uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); foreign_worker uuid:=gen_random_uuid();
  s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); s3 uuid:=gen_random_uuid();
  foreign_shift uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); bad_department uuid:=gen_random_uuid();
BEGIN
  PERFORM set_config('test.schedule_tenant',a::text,true);
  PERFORM set_config('test.schedule_foreign',b::text,true);
  PERFORM set_config('test.schedule_user',u::text,true);
  INSERT INTO public.tenants(id,name,slug) VALUES(a,'Schedule test A','schedule-test-'||a),(b,'Schedule test B','schedule-test-'||b);
  INSERT INTO auth.users(id,email,role,aud) VALUES
    (u,'schedule-test-'||u||'@example.invalid','authenticated','authenticated'),
    (v,'schedule-test-'||v||'@example.invalid','authenticated','authenticated'),
    (z,'schedule-test-'||z||'@example.invalid','authenticated','authenticated');
  INSERT INTO public.users(id,tenant_id,email,role) VALUES
    (u,a,'schedule-test-'||u||'@example.invalid','admin'),(v,a,'schedule-test-'||v||'@example.invalid','worker'),
    (z,b,'schedule-test-'||z||'@example.invalid','worker');
  INSERT INTO public.user_roles(user_id,tenant_id,role) VALUES(u,a,'admin');
  UPDATE public.tenant_categories SET category='Staffing',edition_set_at=now() WHERE tenant_id IN(a,b);
  INSERT INTO public.clients(id,tenant_id,user_id) VALUES(c,a,u),(c2,a,v),(foreign_client,b,z);
  INSERT INTO public.facility(id,tenant_id,client_id,name) VALUES(f,b,foreign_client,'Foreign');
  INSERT INTO public.departments(id,tenant_id,name) VALUES(bad_department,b,'Foreign');
  INSERT INTO public.worker(id,tenant_id,first_name) VALUES(w,a,'Own'),(w2,a,'Own 2'),(foreign_worker,b,'Foreign');
  INSERT INTO public.shifts(id,tenant_id,title,start_date,end_date,is_internal) VALUES
    (s,a,'Internal','2026-11-16','2026-11-30',true);
  INSERT INTO public.shifts(id,tenant_id,title,start_date,end_date,client_id,is_internal) VALUES
    (s2,a,'Client A','2026-11-16','2026-11-30',c,false),
    (s3,a,'Client B','2026-11-16','2026-11-30',c2,false),
    (foreign_shift,b,'Foreign','2026-11-16','2026-11-30',foreign_client,false);
  BEGIN
    UPDATE public.shifts SET facility_id=f WHERE tenant_id=a AND id=s;
    RAISE EXCEPTION 'Cross-tenant facility was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    UPDATE public.shifts SET department_id=bad_department WHERE tenant_id=a AND id=s;
    RAISE EXCEPTION 'Cross-tenant department was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    PERFORM public.assign_fsd_shift_workers(a,s,ARRAY[w,foreign_worker]);
    RAISE EXCEPTION 'Cross-tenant worker was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.worker_shift_assignments WHERE tenant_id=a AND shift_id=s) THEN
    RAISE EXCEPTION 'Invalid assignment batch partially persisted';
  END IF;
  PERFORM public.assign_fsd_shift_workers(a,s,ARRAY[w]);
  BEGIN
    PERFORM public.assign_fsd_shift_workers(a,s,ARRAY[w]);
    RAISE EXCEPTION 'Duplicate assignment was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    PERFORM public.assign_fsd_shift_workers(a,s,ARRAY[w2],'2026-11-01'::date,'2026-11-20'::date);
    RAISE EXCEPTION 'Out-of-range assignment was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.assign_fsd_shift_workers(a,foreign_shift,ARRAY[w2]);
    RAISE EXCEPTION 'Cross-tenant shift was accepted';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  PERFORM public.assign_fsd_shift_workers(a,s2,ARRAY[w2]);
  INSERT INTO public.tenant_feature_overrides(tenant_id,feature_key,enabled) VALUES(a,'multi_client_assignments',false);
  BEGIN
    PERFORM public.assign_fsd_shift_workers(a,s3,ARRAY[w2]);
    RAISE EXCEPTION 'Disabled overlapping multi-client assignment was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.tenant_holidays(tenant_id,name,holiday_date,is_paid) VALUES(a,'Own holiday','2026-11-26',true),(b,'Foreign holiday','2026-11-26',false);
  INSERT INTO public.worker_time_off(tenant_id,worker_id,off_type,start_date,end_date) VALUES
    (a,w,'Vacation','2026-11-01','2026-12-01'),(b,foreign_worker,'Vacation','2026-11-20','2026-11-21');
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid:=current_setting('test.schedule_tenant')::uuid; b uuid:=current_setting('test.schedule_foreign')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.tenant_holidays WHERE tenant_id=a)<>1 THEN RAISE EXCEPTION 'Own holiday missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_holidays WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign holiday leaked'; END IF;
  IF EXISTS(SELECT 1 FROM public.shifts WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign shift leaked'; END IF;
  IF EXISTS(SELECT 1 FROM public.worker_time_off WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign leave leaked'; END IF;
  IF (SELECT count(*) FROM public.worker_time_off WHERE tenant_id=a AND start_date<='2026-11-30' AND end_date>='2026-11-16')<>1 THEN
    RAISE EXCEPTION 'Overlapping leave omitted';
  END IF;
  IF has_function_privilege('authenticated','public.assign_fsd_shift_workers(uuid,uuid,uuid[],date,date,numeric,numeric)','EXECUTE')
    OR has_function_privilege('anon','public.assign_fsd_shift_workers(uuid,uuid,uuid[],date,date,numeric,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'Assignment RPC exposed to API clients';
  END IF;
  IF has_table_privilege('authenticated','public.shifts','INSERT') OR has_table_privilege('authenticated','public.worker_shift_assignments','INSERT') THEN
    RAISE EXCEPTION 'Direct writes bypass server feature checks';
  END IF;
  BEGIN
    INSERT INTO public.tenant_holidays(tenant_id,name,holiday_date) VALUES(b,'Forbidden','2026-11-27');
    RAISE EXCEPTION 'Direct holiday write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
