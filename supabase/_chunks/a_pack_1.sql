-- === 20260414193000_create_agreements.sql ===
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
-- === 20260417121000_create_zoho_sign_requests.sql ===
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
-- === 20260418123000_zoho_sign_email_unique_active.sql ===
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
-- === 20260427120000_applicant_skill_assessment_answers.sql ===
-- Per-question skill assessment answers (normalized). applicant_id = public.worker.id

create table if not exists public.applicant_skill_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.worker (id) on delete cascade,
  category_id uuid not null,
  skill_id uuid not null,
  answer_value integer not null check (answer_value between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, category_id, skill_id)
);

create index if not exists applicant_skill_assessment_answers_applicant_category_idx
  on public.applicant_skill_assessment_answers (applicant_id, category_id);

create or replace function public.touch_applicant_skill_assessment_answers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_applicant_skill_assessment_answers_updated_at
  on public.applicant_skill_assessment_answers;
create trigger trg_applicant_skill_assessment_answers_updated_at
before update on public.applicant_skill_assessment_answers
for each row
execute function public.touch_applicant_skill_assessment_answers_updated_at();
-- === 20260427130000_applicant_skill_assessment_answers_category_fk_api.sql ===
-- Map quiz category to skill_categories; expose table like skill_assessments for anon/auth clients.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'applicant_skill_assessment_answers_category_id_fkey'
  ) then
    alter table public.applicant_skill_assessment_answers
      add constraint applicant_skill_assessment_answers_category_id_fkey
      foreign key (category_id) references public.skill_categories (id) on delete cascade;
  end if;
end $$;

comment on table public.applicant_skill_assessment_answers is
  'Per-question skill quiz answers. applicant_id = worker.id; category_id = skill_categories.id; skill_id = skill_questions.id (FK; same key as JSON in skill_assessments.answers).';

grant select, insert, update, delete on public.applicant_skill_assessment_answers to anon;
grant select, insert, update, delete on public.applicant_skill_assessment_answers to authenticated;
grant select, insert, update, delete on public.applicant_skill_assessment_answers to service_role;

alter table public.applicant_skill_assessment_answers enable row level security;

drop policy if exists "Allow anon read applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow anon insert applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow anon update applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow anon delete applicant_skill_answers" on public.applicant_skill_assessment_answers;

create policy "Allow anon read applicant_skill_answers"
  on public.applicant_skill_assessment_answers for select to anon using (true);

create policy "Allow anon insert applicant_skill_answers"
  on public.applicant_skill_assessment_answers for insert to anon with check (true);

create policy "Allow anon update applicant_skill_answers"
  on public.applicant_skill_assessment_answers for update to anon using (true) with check (true);

create policy "Allow anon delete applicant_skill_answers"
  on public.applicant_skill_assessment_answers for delete to anon using (true);

drop policy if exists "Allow auth read applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow auth insert applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow auth update applicant_skill_answers" on public.applicant_skill_assessment_answers;
drop policy if exists "Allow auth delete applicant_skill_answers" on public.applicant_skill_assessment_answers;

create policy "Allow auth read applicant_skill_answers"
  on public.applicant_skill_assessment_answers for select to authenticated using (true);

create policy "Allow auth insert applicant_skill_answers"
  on public.applicant_skill_assessment_answers for insert to authenticated with check (true);

create policy "Allow auth update applicant_skill_answers"
  on public.applicant_skill_assessment_answers for update to authenticated using (true) with check (true);

create policy "Allow auth delete applicant_skill_answers"
  on public.applicant_skill_assessment_answers for delete to authenticated using (true);