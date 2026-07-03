-- Tenant-scoped email uniqueness for multi-tenant worker and staff profiles.
-- Allows the same email across different tenants; blocks duplicates within one tenant (case-insensitive).

-- Worker: replace global user_id uniqueness with per-tenant user_id uniqueness.
ALTER TABLE public.worker DROP CONSTRAINT IF EXISTS worker_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS worker_tenant_user_id_uidx
  ON public.worker (tenant_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS worker_tenant_email_lower_uidx
  ON public.worker (tenant_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- Staff profiles: replace global email uniqueness with per-tenant email uniqueness.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_lower_uidx
  ON public.users (tenant_id, lower(trim(email)))
  WHERE tenant_id IS NOT NULL AND email IS NOT NULL AND trim(email) <> '';

-- Platform owner signup rows (tenant_id null) remain globally unique by email.
CREATE UNIQUE INDEX IF NOT EXISTS users_platform_email_lower_uidx
  ON public.users (lower(trim(email)))
  WHERE tenant_id IS NULL AND email IS NOT NULL AND trim(email) <> '';
