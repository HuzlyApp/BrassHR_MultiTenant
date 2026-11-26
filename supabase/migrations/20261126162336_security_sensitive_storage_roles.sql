-- API role checks must not be bypassable through a direct Storage client.
CREATE OR REPLACE FUNCTION public.user_can_access_sensitive_worker_files(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
 SELECT (select auth.uid()) IS NOT NULL
 AND coalesce((select auth.jwt())->>'is_anonymous','false') = 'false'
 -- Direct SDK access cannot bypass the app's staff OTP proof. Server APIs use service role after verifying that proof.
 AND coalesce((select auth.jwt())->>'aal','') = 'aal2'
 AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=(select auth.uid()) AND u.is_active IS TRUE
  AND (u.god_admin IS TRUE OR EXISTS (
   SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.tenant_id=p_tenant_id
   AND r.is_active IS TRUE AND lower(r.role) IN ('admin','hr')
  ))
 );
$function$;
REVOKE ALL ON FUNCTION public.user_can_access_sensitive_worker_files(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_sensitive_worker_files(uuid) TO authenticated,service_role;
ALTER POLICY worker_required_files_staff_select ON storage.objects TO authenticated
USING (bucket_id = 'worker_required_files' AND (
 (storage.foldername(name))[1] = (select auth.uid())::text
 OR CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN public.user_can_access_sensitive_worker_files(((storage.foldername(name))[1])::uuid)
 ELSE false END
));
ALTER POLICY worker_required_files_staff_update ON storage.objects TO authenticated
USING (bucket_id = 'worker_required_files' AND (
 (storage.foldername(name))[1] = (select auth.uid())::text
 OR CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN public.user_can_access_sensitive_worker_files(((storage.foldername(name))[1])::uuid)
 ELSE false END
)) WITH CHECK (bucket_id = 'worker_required_files' AND (
 (storage.foldername(name))[1] = (select auth.uid())::text
 OR CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN public.user_can_access_sensitive_worker_files(((storage.foldername(name))[1])::uuid)
 ELSE false END
));
