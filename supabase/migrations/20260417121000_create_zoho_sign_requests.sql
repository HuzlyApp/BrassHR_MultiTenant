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
