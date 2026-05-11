

-- =====================================================================
-- 20260410130000_worker_documents_step2_urls.sql
-- =====================================================================

-- Step 2 (license / TB / CPR) + identity URLs on one row per worker.
-- Run in Supabase SQL editor if you do not use CLI migrations.

ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS nursing_license_url text,
  ADD COLUMN IF NOT EXISTS tb_test_url text,
  ADD COLUMN IF NOT EXISTS cpr_certification_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Enables upsert on worker_id (PostgreSQL treats NULLs as distinct; ensure one row per worker in app).
CREATE UNIQUE INDEX IF NOT EXISTS worker_documents_worker_id_uidx ON public.worker_documents (worker_id);

-- Optional: enforce FK after backfill
-- ALTER TABLE public.worker_documents
--   ADD CONSTRAINT worker_documents_worker_id_fkey
--   FOREIGN KEY (worker_id) REFERENCES public.worker (id) ON DELETE CASCADE;


-- =====================================================================
-- 20260410140000_skill_assessments_user_id_to_worker_id.sql
-- =====================================================================

-- Rename legacy column if present (app code uses worker_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_assessments'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_assessments'
      AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE public.skill_assessments RENAME COLUMN user_id TO worker_id;
  END IF;
END $$;


-- =====================================================================
-- 20260410160000_worker_requirements_front_back_paths.sql
-- =====================================================================

-- Front/back storage paths for SSN & driver's license (matches step-4 UI)
ALTER TABLE public.worker_requirements
  ADD COLUMN IF NOT EXISTS ssn_card_front_path text,
  ADD COLUMN IF NOT EXISTS ssn_card_back_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_front_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_path text;

-- Copy legacy single-column paths into "front" when new columns are empty
UPDATE public.worker_requirements
SET ssn_card_front_path = ssn_card_path
WHERE ssn_card_front_path IS NULL
  AND ssn_card_path IS NOT NULL
  AND trim(ssn_card_path) <> '';

UPDATE public.worker_requirements
SET drivers_license_front_path = drivers_license_path
WHERE drivers_license_front_path IS NULL
  AND drivers_license_path IS NOT NULL
  AND trim(drivers_license_path) <> '';


-- =====================================================================
-- 20260410170000_add_worker_status.sql
-- =====================================================================

-- Adds a simple status field used by the admin recruiter pipeline.
-- Values: new | pending | approved | disapproved

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

-- Keep values constrained (safe even if column already existed without constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'worker_status_chk'
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_status_chk
      CHECK (status IN ('new','pending','approved','disapproved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_status_idx ON public.worker (status);



-- =====================================================================
-- 20260410170000_worker_documents_ssn_dl_back_urls.sql
-- =====================================================================

-- Public URLs for SSN / DL back images (front already use ssn_url, drivers_license_url)
ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS ssn_back_url text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_url text;


-- =====================================================================
-- 20260410192000_create_worker_references.sql
-- =====================================================================

-- Create worker references table (keyed by worker_id)

create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.worker_references (
  id uuid not null default extensions.uuid_generate_v4 (),
  worker_id uuid not null,
  reference_first_name text not null,
  reference_last_name text not null,
  reference_phone text null,
  reference_email text not null,
  created_at timestamp with time zone null default now(),
  constraint worker_references_pkey primary key (id)
) tablespace pg_default;

-- If an older version of the table exists with applicant_id, migrate it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_references'
      and column_name = 'applicant_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'worker_references'
      and column_name = 'worker_id'
  ) then
    alter table public.worker_references rename column applicant_id to worker_id;
  end if;
end $$;

-- Ensure FK exists (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'worker_references_worker_id_fkey'
  ) then
    alter table public.worker_references
      add constraint worker_references_worker_id_fkey
      foreign key (worker_id) references public.worker (id);
  end if;
end $$;

create index if not exists worker_references_worker_id_idx
  on public.worker_references (worker_id);



-- =====================================================================
-- 20260410194500_create_skill_assessments.sql
-- =====================================================================

-- Skill assessments: one row per (worker_id, category)

create extension if not exists pgcrypto;

create table if not exists public.skill_assessments (
  id uuid not null default gen_random_uuid (),
  category text null,
  answers jsonb null,
  created_at timestamp without time zone null default now(),
  completed boolean null default false,
  worker_id uuid not null,
  constraint skill_assessments_pkey primary key (id)
) tablespace pg_default;

-- Ensure foreign key to worker(id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'skill_assessments_worker_id_fkey'
  ) then
    alter table public.skill_assessments
      add constraint skill_assessments_worker_id_fkey
      foreign key (worker_id) references public.worker (id);
  end if;
end $$;

-- Replace legacy UNIQUE(worker_id) with UNIQUE(worker_id, category)
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'skill_assessments_worker_id_key'
  ) then
    alter table public.skill_assessments drop constraint skill_assessments_worker_id_key;
  end if;
exception when undefined_object then
  -- ignore
end $$;

create unique index if not exists skill_assessments_worker_id_category_uidx
  on public.skill_assessments (worker_id, category);



-- =====================================================================
-- 20260410220000_rbac_user_roles_activity_log.sql
-- =====================================================================

-- RBAC: map Supabase Auth users to application roles + immutable audit trail.
-- Apply in Supabase SQL editor or via supabase db push.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('worker', 'recruiter', 'support', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'worker',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log (actor_user_id);

COMMENT ON TABLE public.user_roles IS 'Application RBAC: one row per auth user.';
COMMENT ON TABLE public.activity_log IS 'Security audit log for privileged actions (API writes + sensitive reads).';


-- =====================================================================
-- 20260414180000_zoho_webhook_events.sql
-- =====================================================================

-- Stores raw Zoho webhook deliveries for debugging + async processing.
-- Inserts are intended to be done via Supabase Edge Function using the service role key.

create table if not exists public.zoho_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),

  -- Best-effort idempotency key (header value or derived hash)
  event_id text not null,
  source text not null default 'zoho',

  method text,
  path text,
  query jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,

  -- Parsed JSON if available; otherwise null and raw_body will contain text.
  payload jsonb,
  raw_body text,

  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text
);

create unique index if not exists zoho_webhook_events_event_id_uidx
  on public.zoho_webhook_events (event_id);

create index if not exists zoho_webhook_events_received_at_idx
  on public.zoho_webhook_events (received_at desc);

alter table public.zoho_webhook_events enable row level security;

-- No policies by default. Service role bypasses RLS.



-- =====================================================================
-- 20260414193000_create_agreements.sql
-- =====================================================================

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  applicant_id text,
  request_id text not null unique,

  status text not null default 'pending'
);

alter table public.agreements enable row level security;

-- No policies by default. Service role bypasses RLS.



-- =====================================================================
-- 20260417121000_create_zoho_sign_requests.sql
-- =====================================================================

create table if not exists public.zoho_sign_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  project_id text null,
  email text not null,
  recipient_name text null,
  template_name text not null default 'Onboarding Agreement',
  request_id text not null unique,
  zoho_document_id text null,
  signing_url text null,
  status text not null default 'sent',
  source text not null default 'onboarding',
  raw_send_response jsonb null,
  raw_webhook_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists zoho_sign_requests_request_id_idx
  on public.zoho_sign_requests (request_id);

create index if not exists zoho_sign_requests_email_idx
  on public.zoho_sign_requests (email);

create index if not exists zoho_sign_requests_status_idx
  on public.zoho_sign_requests (status);

create or replace function public.set_zoho_sign_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_zoho_sign_requests_updated_at on public.zoho_sign_requests;
create trigger trg_zoho_sign_requests_updated_at
before update on public.zoho_sign_requests
for each row
execute function public.set_zoho_sign_requests_updated_at();

alter table public.zoho_sign_requests enable row level security;

drop policy if exists "zoho_sign_requests_select_own_user" on public.zoho_sign_requests;
create policy "zoho_sign_requests_select_own_user"
on public.zoho_sign_requests
for select
to authenticated
using (user_id is not null and auth.uid() = user_id);

drop policy if exists "zoho_sign_requests_select_own_email" on public.zoho_sign_requests;
create policy "zoho_sign_requests_select_own_email"
on public.zoho_sign_requests
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);


-- =====================================================================
-- 20260418123000_zoho_sign_email_unique_active.sql
-- =====================================================================

-- One active onboarding Zoho agreement per email: block a second send while a prior
-- request is still sent/viewed/signed/completed. Declined rows are excluded so the
-- same email can start again after a decline.
--
-- If this migration fails, dedupe public.zoho_sign_requests for onboarding emails
-- that have more than one non-declined row before re-running.

create unique index if not exists zoho_sign_requests_onboarding_email_active_uq
  on public.zoho_sign_requests (lower(trim(email)), source)
  where source = 'onboarding'
    and lower(trim(coalesce(status, ''))) <> 'declined';
