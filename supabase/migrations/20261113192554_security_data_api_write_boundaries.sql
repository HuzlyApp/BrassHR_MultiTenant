-- All worker/job mutations use server handlers that authorize tenant + action.
-- RLS membership alone must not bypass module grants or applicant field restrictions.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.worker, public.job_requisitions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker, public.job_requisitions TO service_role;

-- Resolve grants for the authenticated caller only; never accept a caller-supplied user ID.
CREATE OR REPLACE FUNCTION public.staff_can_view_resource(p_tenant_id uuid, p_resource_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.tenant_id = p_tenant_id
    WHERE u.id = (SELECT auth.uid()) AND u.is_active = true
      AND (
        u.god_admin = true OR (
          (ur.is_active = true OR (ur.user_id IS NULL AND u.tenant_id = p_tenant_id))
          AND EXISTS (
            SELECT 1 FROM public.tenant_role_permissions rp
            JOIN public.tenant_roles tr ON tr.tenant_id = rp.tenant_id AND tr.role_key = rp.role_key
            WHERE rp.tenant_id = p_tenant_id AND rp.resource_key = p_resource_key AND rp.can_view = true
              AND (
                rp.role_key = COALESCE(ur.role, u.role)
                OR EXISTS (
                  SELECT 1 FROM public.staff_roles sr WHERE sr.is_active = true AND sr.is_staff = true
                    AND sr.key = rp.role_key
                    AND (sr.storage_key = COALESCE(ur.role,u.role) OR COALESCE(ur.role,u.role) = ANY(sr.aliases))
                )
              )
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.staff_can_view_resource(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_can_view_resource(uuid,text) TO authenticated, service_role;

-- Restrictive policies constrain every older permissive policy, including tenant_isolation.
CREATE POLICY worker_verified_reader ON public.worker AS RESTRICTIVE FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR public.staff_can_view_resource(tenant_id, 'hiring'));
-- Public job boards read the safe projection through /api/public/jobs using the server client.
REVOKE SELECT ON public.job_requisitions FROM anon;
CREATE POLICY job_requisitions_verified_reader ON public.job_requisitions AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.staff_can_view_resource(tenant_id, 'jobs'));
