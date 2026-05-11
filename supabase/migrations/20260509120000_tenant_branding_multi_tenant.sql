-- Multi-tenant branding, god-admin flag, tenant-scoped RBAC helpers.
-- Compatible with deployments that already have public.tenants (minimal columns).

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text,
  is_active boolean NOT NULL DEFAULT true,
  logo_url text,
  primary_color text DEFAULT '#0d9488',
  secondary_color text DEFAULT '#0f766e',
  accent_color text DEFAULT '#99f6e4',
  welcome_headline text,
  welcome_subtitle text,
  auth_background_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0d9488';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#0f766e';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#99f6e4';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_headline text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_subtitle text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS auth_background_image_url text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS god_admin boolean NOT NULL DEFAULT false';
  END IF;
END $$;

-- God-admin accounts are not scoped to one tenant row.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN tenant_id DROP NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id)';
  END IF;
END $$;

COMMENT ON COLUMN public.users.god_admin IS 'Cross-tenant platform admin; omit tenant-bound rows or use impersonation helpers in app/API.';

-- Active tenants readable for anonymous login / onboarding branding.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_public_select_active ON public.tenants;
CREATE POLICY tenants_public_select_active
  ON public.tenants
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Demo tenant branding (Tenant 1 / Tenant 2) — idempotent on slug.
INSERT INTO public.tenants (
  name,
  slug,
  plan,
  is_active,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  welcome_headline,
  welcome_subtitle,
  auth_background_image_url,
  updated_at
)
VALUES
  (
    'Tenant One Health',
    'tenant-1',
    'starter',
    true,
    '/images/new-logo-nexus.svg',
    '#0d9488',
    '#134e4a',
    '#5eead4',
    'Grow your care team.',
    'Fast onboarding with dedicated support.',
    '/images/handshake.jpg',
    now()
  ),
  (
    'Tenant Two Staffing',
    'tenant-2',
    'starter',
    true,
    '/icons/admin-recruiter/nexus-main-logo.svg',
    '#2563eb',
    '#1e3a8a',
    '#93c5fd',
    'Welcome to Tenant Two Staffing.',
    'Built for recruiters and allied health roles.',
    '/images/nurse.jpg',
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  accent_color = EXCLUDED.accent_color,
  welcome_headline = COALESCE(public.tenants.welcome_headline, EXCLUDED.welcome_headline),
  welcome_subtitle = COALESCE(public.tenants.welcome_subtitle, EXCLUDED.welcome_subtitle),
  auth_background_image_url = COALESCE(public.tenants.auth_background_image_url, EXCLUDED.auth_background_image_url),
  updated_at = now();
