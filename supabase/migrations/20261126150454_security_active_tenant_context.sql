-- Revocation and anonymous claims must also apply to direct PostgREST access.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
 SELECT u.tenant_id FROM public.users u
 WHERE u.id = (select auth.uid()) AND u.is_active IS TRUE
 AND coalesce((select auth.jwt())->>'is_anonymous','false') = 'false'
 AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
   AND r.tenant_id = u.tenant_id AND r.is_active IS FALSE)
 LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO anon, authenticated, service_role;
