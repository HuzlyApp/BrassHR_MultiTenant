-- Rollback-only database policy test; no customer record/file contents are returned.
-- Models verified JWT claims. Actual authenticator enrollment/challenges need live QA.
BEGIN;
DO $test$
DECLARE
  admin_id uuid; tenant_a uuid; foreign_id uuid;
  other_id uuid; other_tenant uuid; visible integer;
BEGIN
  SELECT u.id,r.tenant_id INTO admin_id,tenant_a
  FROM public.users u JOIN public.user_roles r ON r.user_id=u.id
  WHERE u.is_active IS TRUE AND u.god_admin IS NOT TRUE
    AND r.is_active IS TRUE AND lower(r.role)='admin' LIMIT 1;
  SELECT u.id,r.tenant_id INTO other_id,other_tenant
  FROM public.users u JOIN public.user_roles r ON r.user_id=u.id
  WHERE u.is_active IS TRUE AND u.god_admin IS NOT TRUE AND r.is_active IS TRUE
    AND lower(r.role) IN ('recruiter','client','manager','worker','candidate') LIMIT 1;
  IF admin_id IS NULL OR other_id IS NULL THEN
    RAISE EXCEPTION 'Need active privileged and non-privileged QA identities';
  END IF;
  SELECT t.id INTO foreign_id FROM public.tenants t WHERE t.id<>tenant_a
    AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=admin_id
      AND r.tenant_id=t.id AND r.is_active IS TRUE) LIMIT 1;
  IF foreign_id IS NULL THEN RAISE EXCEPTION 'Need foreign tenant for verification'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,
    'role','authenticated','is_anonymous',false,'aal','aal1')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF public.user_can_access_sensitive_worker_files(tenant_a) THEN
    RAISE EXCEPTION 'Password-only staff session bypassed MFA';
  END IF;
  SELECT count(*) INTO visible FROM storage.objects WHERE bucket_id='worker_required_files'
    AND name LIKE tenant_a::text||'/%';
  IF visible<>0 THEN RAISE EXCEPTION 'Password-only staff read tenant identity objects'; END IF;
  PERFORM count(*) FROM storage.objects WHERE bucket_id='worker_required_files' AND name LIKE 'portal/%';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,
    'role','authenticated','is_anonymous',false,'aal','aal2')::text,true);
  IF NOT public.user_can_access_sensitive_worker_files(tenant_a) THEN
    RAISE EXCEPTION 'Verified Admin was denied own tenant';
  END IF;
  IF public.user_can_access_sensitive_worker_files(foreign_id) THEN
    RAISE EXCEPTION 'Verified Admin gained foreign tenant access';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,
    'role','authenticated','is_anonymous',false,'aal','aal2')::text,true);
  IF public.user_can_access_sensitive_worker_files(other_tenant) THEN
    RAISE EXCEPTION 'Non-privileged role gained identity object access';
  END IF;
  EXECUTE 'RESET ROLE';
END $test$;
ROLLBACK;
