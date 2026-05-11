
-- === 20260507140000_storage_buckets_worker_uploads.sql ===
-- Private buckets expected by onboarding + admin recruiter storage scans.
-- See lib/supabase-storage-buckets.ts and app/api/admin/worker-profile/route.ts.

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES
  ('worker-resumes', 'worker-resumes', false, false),
  ('worker_required_files', 'worker_required_files', false, false),
  ('worker-onboarding', 'worker-onboarding', false, false),
  ('docs', 'docs', false, false)
ON CONFLICT (id) DO NOTHING;

-- === 20260507200000_seed_skill_questions_catalog.sql ===
-- Canonical skill quiz questions seed (upsert by id).
-- Applies to catalogs shared across onboarding skill assessments.

-- Required FK parents (remote DBs may not have seeded categories yet).
INSERT INTO public.skill_categories (id, title, description, order_number, slug, created_at)
VALUES
  ('030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Mobility, Positioning & Patient Handling', null, 2, 'mobility', '2026-03-09 11:26:48.278211'::timestamptz),
  ('089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Professional Practices & Documentation', null, 5, 'documentation', '2026-03-09 11:26:48.278211'::timestamptz),
  ('880c1f95-f033-4ab7-9b5f-1721564901b0', 'Basic Patient Care & Hygiene', null, 1, 'basic-care', '2026-03-09 11:26:48.278211'::timestamptz),
  ('a86761a6-2751-42ab-9f75-6fc80117977e', 'Assessment, Monitoring & Emergency Response', null, 4, 'monitoring', '2026-03-09 11:26:48.278211'::timestamptz),
  ('e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Clinical Skills & Procedures', null, 3, 'clinical', '2026-03-09 11:26:48.278211'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  order_number = EXCLUDED.order_number,
  slug = EXCLUDED.slug,
  created_at = EXCLUDED.created_at;

INSERT INTO public.skill_questions (id, category_id, question, quiz_number, created_at)
VALUES
  ('016647a9-6519-4b38-9458-33d2c86eb934', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Observe safety procedures and precautions', 5, '2026-03-14 16:03:26.540251'),
  ('01ffebde-2282-4bc2-8b4d-779636fc2c7e', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Assist with medical examinations', 3, '2026-03-14 16:03:26.540251'),
  ('0494e827-4972-492d-af1b-38eb8464e61f', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'IV monitoring and infusion site checks', 4, '2026-03-14 16:03:26.540251'),
  ('06cfa03c-cac6-4dc3-b755-a64ce739abb0', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Isolation procedure for specimen collection', 8, '2026-03-14 16:03:26.540251'),
  ('088dda1c-3cbf-4bc9-bb96-41cb94943385', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Provide comfort, safety, and privacy', 5, '2026-03-14 16:03:26.540251'),
  ('0c6209d6-9487-4569-ab88-efef17ab5bd8', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'CPR', 4, '2026-03-14 16:03:26.540251'),
  ('0c7b5326-1259-45ec-a4e2-5b4f397053d9', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Enemas (cleansing, retention, Harris flush) and suppositories', 8, '2026-03-14 16:03:26.540251'),
  ('11367940-ac3f-4de7-b0db-5a3e177a75c8', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Patient transfer and transport (wheelchair, gurney, chair)', 2, '2026-03-14 16:03:26.540251'),
  ('11758df1-0ad1-4e9b-8494-271202e2f1ec', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Administration of medication (oral, IM, SQ; dosage computation)', 1, '2026-03-14 16:03:26.540251'),
  ('1268e140-4c81-48de-9bb7-750738fc5ddf', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Ear drops and topical medication application', 9, '2026-03-14 16:03:26.540251'),
  ('13c8c1a8-8720-4d56-bc75-7c51e114d16b', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Vital signs and weight monitoring', 8, '2026-03-14 16:03:26.540251'),
  ('19b36c33-f799-4c51-88c3-c8bdca724540', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Oxygen administration and pulse oximetry', 5, '2026-03-14 16:03:26.540251'),
  ('27ade349-5f02-40d4-80bc-5bd3c62ffd20', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'EHR medical record competency', 7, '2026-03-14 16:03:26.540251'),
  ('2d6a5efb-cb88-4308-a218-1339ce9c2e9a', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Infection control precautions', 1, '2026-03-14 16:03:26.540251'),
  ('337136e4-2c9d-45fe-8b0d-6edfd7271385', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Cast care and traction', 4, '2026-03-14 16:03:26.540251'),
  ('3387fbe9-d7c7-45ae-9b9b-9ef359aeb499', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Bandaging and dressing (sterile)', 8, '2026-03-14 16:03:26.540251'),
  ('33b269a3-df29-46bc-b9c6-57d2d7b68518', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Surgical preps', 7, '2026-03-14 16:03:26.540251'),
  ('3cdf13ab-94a0-4db9-8120-3418d680f689', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Transfer/ transport patients: gurney', 9, '2026-04-27 04:17:53.324489'),
  ('3da1a63a-47a0-4e74-a2f6-1f9ff61561a3', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Skin care (includes decubitus care)', 3, '2026-03-14 16:00:46.846522'),
  ('4289844a-bfbe-44df-bf83-8565b15975ab', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Application of heat and cold', 5, '2026-03-14 16:03:26.540251'),
  ('441a6f26-07d2-4f4d-b2cb-54dadbd9ad9d', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Discharge patients', 4, '2026-03-14 16:03:26.540251'),
  ('4b21af6f-5ec2-42c2-b1f8-faf0a1777429', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Hand hygiene', 6, '2026-03-14 16:03:26.540251'),
  ('4e7df2a9-b2fa-4b99-87ac-c137d1cc6b9a', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Patient observation and monitoring for body system changes', 1, '2026-03-14 16:03:26.540251'),
  ('54d0a901-1ef7-436f-ba76-7884978b8b52', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Draping', 9, '2026-03-14 16:03:26.540251'),
  ('54db3f8c-b518-47af-ad6c-51d17a046502', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Activities of daily living (bathing: sitz, tub, bed, shower; mouth care; nail care; elimination needs)', 1, '2026-03-14 16:00:46.846522'),
  ('5f1b95de-bd19-49e7-b646-1586f24e42f1', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Binders', 10, '2026-03-14 16:00:46.846522'),
  ('68d588ef-243b-4ee3-9822-4ecb470f2a07', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Restraints (use and monitoring)', 7, '2026-03-14 16:00:46.846522'),
  ('6b13a6d4-be29-4d3a-a8ad-3043e7ea59c4', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Patient care plans', 5, '2026-03-14 16:03:26.540251'),
  ('6b4ae8e9-3856-4545-9176-9bc4a538b41e', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Nutritional check and support', 4, '2026-03-14 16:00:46.846522'),
  ('6b514aad-859c-4429-b92d-23f8bdbf2066', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Report patient observations and changes', 6, '2026-03-14 16:03:26.540251'),
  ('843ba2bd-7635-4794-ab43-52d100961af9', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Charting and computerized documentation', 6, '2026-03-14 16:03:26.540251'),
  ('8f962ce2-46f7-4d31-a095-80ac54f12020', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Specimen collection (urine, stool, sputum, culture)', 2, '2026-03-14 16:03:26.540251'),
  ('90fc3cfb-ff83-4346-8c50-33bfd96bb4ba', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Admission of patients', 3, '2026-03-14 16:03:26.540251'),
  ('93b165b2-7aff-4aab-bc73-34f64a16f9ec', '880c1f95-f033-4ab7-9b5f-1721564901b0', 'Body alignment and positioning (includes range of motion)', 2, '2026-03-14 16:00:46.846522'),
  ('9c73bb2d-804b-4220-9bd9-8e82720b06de', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Pre-op and post-op care', 6, '2026-03-14 16:03:26.540251'),
  ('9f553cd0-00be-497f-bfe0-21317db11039', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Traction', 10, '2026-04-27 04:17:53.324489'),
  ('a0a9699d-6f4d-4d60-8409-148c44e682b5', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Colostomy care and irrigation', 3, '2026-03-14 16:03:26.540251'),
  ('b417b32d-4933-4ee5-a448-11630757905f', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Aseptic technique', 7, '2026-03-14 16:03:26.540251'),
  ('b54eb702-033f-4478-9337-82651292e0be', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Catheterization / Foley catheter care', 2, '2026-03-14 16:03:26.540251'),
  ('b8c9ec37-08da-4203-a37e-df31f2764030', 'a86761a6-2751-42ab-9f75-6fc80117977e', 'Pain assessment', 2, '2026-03-14 16:03:26.540251'),
  ('c3eb6f72-dc7e-41d8-9195-80a4701d91a7', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Neurological check', 9, '2026-03-14 16:03:26.540251'),
  ('cf16fa68-dbb7-4782-94d1-d041f4cfce26', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Ambulation (includes crutch walking)', 1, '2026-03-14 16:03:26.540251'),
  ('d940d504-bb21-40b3-b367-c9b965bb7a51', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Oral suction and tracheostomy suctioning', 6, '2026-03-14 16:03:26.540251'),
  ('dbb4eb11-bcd5-4145-ae12-e82cce611970', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Postural drainage', 10, '2026-03-14 16:03:26.540251'),
  ('ec403678-e05d-466c-8973-f6a3f2546d63', '030beb6c-df9f-4d51-a5cc-10c4620b1a85', 'Body systems review (head-to-toe data collection)', 3, '2026-03-14 16:03:26.540251'),
  ('f7cba8ea-50b1-4be5-acb5-0f1d6284a055', '089c06cc-7ce2-446b-9f56-1c7a9cb068fd', 'Urine test for glucose/ acetone', 8, '2026-04-27 04:17:53.324489'),
  ('f881f6a0-c50e-4d56-b820-e9663a109e10', 'e363b853-8c53-4b63-88fb-dd2a3003ba87', 'Diabetic testing and monitoring', 7, '2026-03-14 16:03:26.540251')
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  question = EXCLUDED.question,
  quiz_number = EXCLUDED.quiz_number,
  created_at = EXCLUDED.created_at;

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

