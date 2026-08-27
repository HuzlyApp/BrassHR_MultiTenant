-- Staff invitations + tenant-scoped membership status for the Admin Console.
-- Invite/provisioning writes go through the service role. RLS is deny-by-default.

-- ---------------------------------------------------------------------------
-- Membership status (tenant-scoped suspend) and invite provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.is_active IS
  'Tenant-scoped staff access. False suspends this membership without deleting the auth identity.';
COMMENT ON COLUMN public.users.must_change_password IS
  'When true, staff must complete password setup before using the admin/recruiter app.';

-- ---------------------------------------------------------------------------
-- staff_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  role public.app_role NOT NULL DEFAULT 'client'::public.app_role,
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  invited_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'failed', 'revoked')),
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  accepted_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_invitations_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_pending_email_uidx
  ON public.staff_invitations (tenant_id, lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS staff_invitations_tenant_created_idx
  ON public.staff_invitations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_invitations_user_idx
  ON public.staff_invitations (invited_user_id)
  WHERE invited_user_id IS NOT NULL;

COMMENT ON TABLE public.staff_invitations IS
  'Tenant-scoped staff invite metadata. Activation tokens live in Supabase Auth, never in this table.';

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_invitations FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_invitations FROM anon;
REVOKE ALL ON TABLE public.staff_invitations FROM authenticated;
GRANT ALL ON TABLE public.staff_invitations TO service_role;

-- ---------------------------------------------------------------------------
-- Staff helpers: suspended memberships are not staff
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_is_tenant_staff(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND ur.role IN ('admin'::public.app_role, 'client'::public.app_role)
      AND ur.is_active = true
      AND u.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = p_tenant_id
      AND u.role IN ('admin'::public.app_role, 'client'::public.app_role)
      AND u.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = u.id
          AND ur.tenant_id = p_tenant_id
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_tenant_admin(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.god_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND ur.role::text = 'admin'
      AND ur.is_active = true
      AND u.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_id = p_tenant_id
      AND u.role::text IN ('admin', 'owner')
      AND u.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = u.id
          AND ur.tenant_id = p_tenant_id
          AND ur.is_active = false
      )
  );
$function$;

-- Users cannot self-flip suspend / password-setup flags via users_update_own.
CREATE OR REPLACE FUNCTION public.protect_users_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.god_admin IS DISTINCT FROM OLD.god_admin
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     )
     AND COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'Cannot modify protected user security columns'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
