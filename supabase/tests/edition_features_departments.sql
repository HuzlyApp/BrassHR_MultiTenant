-- Run in development as postgres. Every fixture and change is rolled back.
BEGIN;
DO $$ BEGIN
  IF has_function_privilege('anon','public.seed_tenant_role_access(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.seed_tenant_role_access(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Internal role seeding is exposed to API clients';
  END IF;
END $$;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); u uuid := gen_random_uuid();
        root uuid := gen_random_uuid(); child uuid := gen_random_uuid(); foreign_root uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('test.fsd_tenant_a', a::text, true);
  PERFORM set_config('test.fsd_tenant_b', b::text, true);
  PERFORM set_config('test.fsd_user', u::text, true);
  PERFORM set_config('test.fsd_root', root::text, true);
  PERFORM set_config('test.fsd_child', child::text, true);
  INSERT INTO public.tenants(id, name, slug) VALUES (a, 'FSD rollback test A', 'fsd-test-' || a), (b, 'FSD rollback test B', 'fsd-test-' || b);
  INSERT INTO auth.users(id, email, role, aud) VALUES(u, 'fsd-test-' || u || '@example.invalid', 'authenticated', 'authenticated');
  INSERT INTO public.users(id, tenant_id, email, role) VALUES(u, a, 'fsd-test-' || u || '@example.invalid', 'admin');
  INSERT INTO public.user_roles(user_id, tenant_id, role) VALUES(u, a, 'admin');
  IF EXISTS(SELECT 1 FROM public.tenant_effective_features WHERE tenant_id IN (a,b)) THEN
    RAISE EXCEPTION 'Unclassified tenant unexpectedly has features';
  END IF;
  UPDATE public.tenant_categories SET category='SMB', edition_set_at=now() WHERE tenant_id=a;
  UPDATE public.tenant_categories SET category='Staffing', edition_set_at=now() WHERE tenant_id=b;
  INSERT INTO public.tenant_feature_overrides(tenant_id,feature_key,enabled) VALUES(a,'bill_rates',true),(b,'timesheets',false);
  INSERT INTO public.departments(id,tenant_id,name) VALUES(root,a,'Root'),(foreign_root,b,'Foreign root');
  INSERT INTO public.departments(id,tenant_id,name,parent_department_id) VALUES(child,a,'Child',root);
  BEGIN
    UPDATE public.departments SET parent_department_id=child WHERE tenant_id=a AND id=root;
    RAISE EXCEPTION 'Hierarchy cycle was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.departments SET parent_department_id=foreign_root WHERE tenant_id=a AND id=child;
    RAISE EXCEPTION 'Cross-tenant parent was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid := current_setting('test.fsd_tenant_a')::uuid; b uuid := current_setting('test.fsd_tenant_b')::uuid;
BEGIN
  IF NOT public.user_is_tenant_staff(a) OR public.user_is_tenant_staff(b) THEN RAISE EXCEPTION 'Real membership helper scope failed'; END IF;
  IF (SELECT count(*) FROM public.tenant_effective_features WHERE tenant_id=a) <> 7 THEN RAISE EXCEPTION 'Own features missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_effective_features WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign tenant features leaked'; END IF;
  IF NOT (SELECT enabled FROM public.tenant_effective_features WHERE tenant_id=a AND feature_key='bill_rates') THEN RAISE EXCEPTION 'Override not applied'; END IF;
  IF (SELECT enabled FROM public.tenant_effective_features WHERE tenant_id=a AND feature_key='manage_clients') THEN RAISE EXCEPTION 'SMB default incorrect'; END IF;
  IF NOT (SELECT enabled FROM public.tenant_effective_features WHERE tenant_id=a AND feature_key='timesheets') THEN RAISE EXCEPTION 'Foreign override affected own tenant'; END IF;
  IF EXISTS(SELECT 1 FROM public.tenant_feature_overrides WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign override visible'; END IF;
  IF EXISTS(SELECT 1 FROM public.departments WHERE tenant_id=b) THEN RAISE EXCEPTION 'Foreign department visible'; END IF;
  BEGIN
    INSERT INTO public.tenant_feature_overrides(tenant_id,feature_key,enabled) VALUES(a,'hiring_ai',true);
    RAISE EXCEPTION 'Authenticated direct feature mutation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.departments(tenant_id,name) VALUES(b,'Forbidden department');
    RAISE EXCEPTION 'Cross-tenant department creation allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
DECLARE a uuid := current_setting('test.fsd_tenant_a')::uuid; u uuid := current_setting('test.fsd_user')::uuid;
BEGIN
  UPDATE public.user_roles SET is_active=false WHERE tenant_id=a AND user_id=u;
  IF public.user_is_tenant_staff(a) THEN RAISE EXCEPTION 'Suspended membership retained staff access'; END IF;
END $$;
ROLLBACK;
