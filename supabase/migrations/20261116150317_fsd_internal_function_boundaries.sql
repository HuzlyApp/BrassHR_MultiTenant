-- Internal seed functions are invoked by the server or tenant triggers only.
REVOKE ALL ON FUNCTION public.seed_tenant_role_access(uuid), public.trg_tenants_seed_role_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_role_access(uuid), public.trg_tenants_seed_role_access() TO service_role;
REVOKE ALL ON FUNCTION public.user_is_tenant_staff(uuid), public.user_is_tenant_admin(uuid) FROM anon;
