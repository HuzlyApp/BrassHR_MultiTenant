-- One transaction replaces three serial HTTP writes and cannot leave a role without its grants.
CREATE OR REPLACE FUNCTION public.update_tenant_role_permissions(
  p_tenant_id uuid, p_role_key text, p_label text, p_description text, p_permissions jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE v_is_system boolean; v_is_admin boolean;
BEGIN
  IF p_tenant_id IS NULL OR btrim(coalesce(p_role_key, '')) = '' OR
     btrim(coalesce(p_label, '')) = '' OR char_length(p_label) > 80 OR
     jsonb_typeof(p_permissions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_permissions) = 0 THEN
    RAISE EXCEPTION 'Role details are invalid' USING ERRCODE = '22023';
  END IF;
  SELECT is_system, is_admin INTO v_is_system, v_is_admin FROM public.tenant_roles
    WHERE tenant_id = p_tenant_id AND role_key = p_role_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found' USING ERRCODE = 'P0002'; END IF;
  IF v_is_system AND v_is_admin AND NOT EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_permissions) AS x(resource_key text, can_view boolean, can_edit boolean)
    WHERE x.resource_key = 'settings_company' AND x.can_view AND x.can_edit
  ) THEN RAISE EXCEPTION 'The admin role must keep access to edit company settings' USING ERRCODE = '22023'; END IF;
  UPDATE public.tenant_roles SET label = btrim(p_label), description = p_description
    WHERE tenant_id = p_tenant_id AND role_key = p_role_key;
  DELETE FROM public.tenant_role_permissions WHERE tenant_id = p_tenant_id AND role_key = p_role_key;
  INSERT INTO public.tenant_role_permissions(tenant_id, role_key, resource_key, can_view, can_edit, can_delete)
    SELECT p_tenant_id, p_role_key, x.resource_key, coalesce(x.can_view, false), coalesce(x.can_edit, false), coalesce(x.can_delete, false)
    FROM jsonb_to_recordset(p_permissions) AS x(resource_key text, can_view boolean, can_edit boolean, can_delete boolean);
END;
$$;
REVOKE ALL ON FUNCTION public.update_tenant_role_permissions(uuid,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_role_permissions(uuid,text,text,text,jsonb) TO service_role;
COMMENT ON FUNCTION public.update_tenant_role_permissions(uuid,text,text,text,jsonb) IS
  'Server-only atomic tenant-role save. The staff API validates user-management permission and tenant scope before invoking.';
