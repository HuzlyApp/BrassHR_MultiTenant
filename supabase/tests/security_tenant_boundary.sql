BEGIN;
DO $test$
DECLARE actor uuid; tenant_a uuid; denied boolean := false; visible integer;
BEGIN
 SELECT u.id,u.tenant_id INTO actor,tenant_a FROM public.users u
 WHERE u.is_active IS TRUE AND u.god_admin IS NOT TRUE AND lower(u.role)='admin'
 AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.tenant_id=u.tenant_id AND r.is_active IS TRUE)
 AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id<>u.tenant_id) LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Need an active Admin and two tenants for boundary verification'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO visible FROM public.tenants WHERE id<>tenant_a;
 IF visible<>0 THEN RAISE EXCEPTION 'Cross-tenant company read exposed rows'; END IF;
 SELECT count(*) INTO visible FROM public.tenants WHERE id=tenant_a;
 IF visible<>1 THEN RAISE EXCEPTION 'Own tenant Admin read failed'; END IF;
 BEGIN UPDATE public.users SET god_admin=true WHERE id=actor;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Self privilege escalation was not rejected'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',true)::text,true);
 IF public.current_tenant_id() IS NOT NULL THEN RAISE EXCEPTION 'Anonymous claim acquired tenant scope'; END IF;
 SELECT count(*) INTO visible FROM public.tenants;
 IF visible<>0 THEN RAISE EXCEPTION 'Anonymous authenticated account read private company rows'; END IF;
 EXECUTE 'RESET ROLE';
 EXECUTE 'SET LOCAL ROLE anon';
 denied:=false;
 BEGIN PERFORM count(*) FROM public.tenants;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous table enumeration was not rejected'; END IF;
 IF public.public_tenant_branding('slug','') IS NOT NULL THEN RAISE EXCEPTION 'Blank branding lookup accepted'; END IF;
 IF public.public_tenant_branding('slug','braas-hr') ?| ARRAY['ein','email','phone','plan'] THEN RAISE EXCEPTION 'Private branding fields exposed'; END IF;
 EXECUTE 'RESET ROLE';
END $test$;
ROLLBACK;
