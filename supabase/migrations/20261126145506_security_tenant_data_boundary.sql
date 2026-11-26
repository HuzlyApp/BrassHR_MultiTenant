-- Apply after public_tenant_branding callers have been deployed.
DROP POLICY IF EXISTS tenants_public_select_active ON public.tenants;
DROP POLICY IF EXISTS tenants_update_member ON public.tenants;
REVOKE ALL ON public.tenants FROM anon;
-- Tenant mutations must pass server-side staff permissions, never browser RLS alone.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tenants FROM authenticated;
CREATE POLICY tenants_read_active_members ON public.tenants FOR SELECT TO authenticated
USING (
  coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (select auth.uid())
    AND u.is_active IS TRUE AND (u.god_admin IS TRUE OR (u.tenant_id = tenants.id AND (select public.current_tenant_id()) = tenants.id AND lower(u.role) IN ('admin', 'hr'))))
);
