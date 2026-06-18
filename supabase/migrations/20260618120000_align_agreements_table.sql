-- Align agreements across environments.
-- Remote brass-hr project already uses: id, tenant_id, user_id, request_id, status, created_at.
-- Older local migrations may still have applicant_id / updated_at.

alter table public.agreements
  add column if not exists tenant_id uuid references public.tenants (id) on delete cascade;

alter table public.agreements
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.agreements
  add column if not exists applicant_id text;

alter table public.agreements
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agreements'
      and column_name = 'applicant_id'
  ) then
    update public.agreements
    set user_id = applicant_id::uuid
    where user_id is null
      and applicant_id is not null
      and applicant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    update public.agreements
    set applicant_id = user_id::text
    where (applicant_id is null or btrim(applicant_id) = '')
      and user_id is not null;
  end if;
end $$;

update public.agreements
set status = case
  when status in ('signed', 'completed') then 'signed'
  when status in ('sent', 'pending') then 'pending'
  else status
end
where status in ('sent', 'completed');

create unique index if not exists agreements_request_id_key on public.agreements (request_id);

create index if not exists agreements_user_id_idx on public.agreements (user_id);

create index if not exists agreements_tenant_user_idx on public.agreements (tenant_id, user_id);
