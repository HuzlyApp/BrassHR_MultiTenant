-- === 20260508200000_skill_catalog_select_policies.sql ===
-- skill_categories / skill_questions: RLS enabled but no policies â‡’ anon REST returns [].
-- Allow read for onboarding clients (anon + authenticated).

grant select on table public.skill_categories to anon, authenticated;
grant select on table public.skill_questions to anon, authenticated;

drop policy if exists "public read categories" on public.skill_categories;
create policy "public read categories"
  on public.skill_categories
  for select
  to public
  using (true);

drop policy if exists "public read questions" on public.skill_questions;
create policy "public read questions"
  on public.skill_questions
  for select
  to public
  using (true);
-- === 20260508210000_onboarding_skill_assessment_worker_rls.sql ===
-- Fix skill save: worker select/update failed under RLS (tenant_isolation depends on current_tenant_id(),
-- which read public.users and re-triggered tenant RLS â€” and anon applicants may have no users row).

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid() limit 1;
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to anon, authenticated, service_role;

-- Permit session-scoped worker access when the row belongs to auth.uid().
drop policy if exists "worker_own_session" on public.worker;
create policy "worker_own_session"
  on public.worker
  for all
  to public
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- skill_assessments had RLS with no policies (deny-all through PostgREST).
grant select, insert, update, delete on public.skill_assessments to anon, authenticated;

drop policy if exists "skill_assessments_worker_linked" on public.skill_assessments;
create policy "skill_assessments_worker_linked"
  on public.skill_assessments
  for all
  to public
  using (
    exists (
      select 1 from public.worker w
      where w.id = skill_assessments.worker_id
        and w.user_id = auth.uid()
    )
    or worker_id = auth.uid()
  )
  with check (
    exists (
      select 1 from public.worker w
      where w.id = skill_assessments.worker_id
        and w.user_id = auth.uid()
    )
    or worker_id = auth.uid()
  );

-- Normalized quiz answers â€” same denial issue when RLS on and no tenant-safe policies here.
grant select, insert, update, delete on public.applicant_skill_assessment_answers to anon, authenticated;

drop policy if exists "applicant_skill_answers_own" on public.applicant_skill_assessment_answers;
create policy "applicant_skill_answers_own"
  on public.applicant_skill_assessment_answers
  for all
  to public
  using (
    exists (
      select 1 from public.worker w
      where w.id = applicant_skill_assessment_answers.applicant_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.worker w
      where w.id = applicant_skill_assessment_answers.applicant_id
        and w.user_id = auth.uid()
    )
  );
-- === 20260508240000_zoho_sign_requests_request_id_unique_for_upsert.sql ===
-- PostgREST/Supabase upsert(onConflict: "request_id") needs a non-partial UNIQUE on request_id.

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where n.nspname = 'public'
      and t.relname = 'zoho_sign_requests'
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'request_id'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'zoho_sign_requests'
      and indexname = 'zoho_sign_requests_request_id_uidx'
  ) then
    return;
  end if;

  drop index if exists public.zoho_sign_requests_request_id_idx;

  create unique index zoho_sign_requests_request_id_uidx
    on public.zoho_sign_requests (request_id);
end $$;
-- === 20260509120000_tenant_branding_multi_tenant.sql ===
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

-- Demo tenant branding (Tenant 1 / Tenant 2) â€” idempotent on slug.
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
-- === 20260510120000_tenants_branding_columns_reload.sql ===
-- Ensure tenant branding columns exist (fixes PostgREST: "could not find ... in the schema cache").
-- Safe to rerun: IF NOT EXISTS for each ALTER.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0d9488';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#0f766e';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#99f6e4';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_headline text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_subtitle text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS auth_background_image_url text;

-- Ask PostgREST to pick up DDL without waiting for periodic refresh (hosted Supabase).
NOTIFY pgrst, 'reload schema';