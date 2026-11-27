-- Candidate-created fields must not become profession-wide requirements.
alter table public.tenant_profession_documents add column worker_id uuid references public.worker(id) on delete cascade;
create index tenant_profession_documents_worker_idx on public.tenant_profession_documents (worker_id) where worker_id is not null;
drop index public.tenant_profession_documents_name_uidx;
create unique index tenant_profession_documents_name_uidx on public.tenant_profession_documents (tenant_id, profession_id, lower(name)) where is_active and worker_id is null;
create unique index tenant_profession_documents_worker_name_uidx on public.tenant_profession_documents (tenant_id, profession_id, worker_id, lower(name)) where is_active and worker_id is not null;
drop policy tenant_profession_documents_applicant_select on public.tenant_profession_documents;
create policy tenant_profession_documents_applicant_select on public.tenant_profession_documents for select to authenticated using (
  exists (select 1 from public.worker w where w.tenant_id = tenant_profession_documents.tenant_id
    and (tenant_profession_documents.worker_id is null or w.id = tenant_profession_documents.worker_id)
    and public.approved_applicant_owns_worker(w.id))
);

-- Service-only state tied to the exact Auth session; client cookies cannot renew it.
create table public.staff_session_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.staff_session_activity enable row level security;
revoke all on public.staff_session_activity from public, anon, authenticated;
grant select, insert, update on public.staff_session_activity to service_role;
create index staff_session_activity_user_idx on public.staff_session_activity (user_id);

create or replace function public.check_staff_session_activity(p_user_id uuid, p_session_id uuid, p_action text default 'check')
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v public.staff_session_activity; v_now timestamptz := clock_timestamp();
begin
  if p_action not in ('check','start','touch') then return false; end if;
  if p_action = 'start' then
    insert into public.staff_session_activity (session_id,user_id) values (p_session_id,p_user_id) on conflict (session_id) do nothing;
  end if;
  select * into v from public.staff_session_activity where session_id=p_session_id and user_id=p_user_id for update;
  if not found or v.revoked_at is not null then return false; end if;
  if v.last_activity_at <= v_now - interval '30 minutes' or v.started_at <= v_now - interval '12 hours' then
    update public.staff_session_activity set revoked_at=v_now where session_id=p_session_id and user_id=p_user_id;
    return false;
  end if;
  if p_action = 'touch' then
    update public.staff_session_activity set last_activity_at=v_now where session_id=p_session_id and user_id=p_user_id;
  end if;
  return true;
end;
$$;
revoke all on function public.check_staff_session_activity(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.check_staff_session_activity(uuid,uuid,text) to service_role;

-- Anonymous access is a bounded first-application flow, never a reusable account.
create table public.initial_application_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null unique references auth.sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  job_token text not null default '',
  expires_at timestamptz not null default (now() + interval '2 hours')
);
alter table public.initial_application_sessions enable row level security;
revoke all on public.initial_application_sessions from public,anon,authenticated;
grant select,insert,update on public.initial_application_sessions to service_role;
create index initial_application_sessions_tenant_idx on public.initial_application_sessions (tenant_id);

create or replace function public.check_initial_application_session(p_user_id uuid, p_session_id uuid, p_tenant_id uuid, p_job_token text default null, p_start boolean default false)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v public.initial_application_sessions;
begin
  if p_start and p_tenant_id is not null then
    insert into public.initial_application_sessions(user_id,session_id,tenant_id,job_token)
    select p_user_id,p_session_id,p_tenant_id,coalesce(p_job_token,'')
    where not exists (select 1 from public.worker w where w.user_id=p_user_id and w.tenant_id=p_tenant_id)
    on conflict (user_id) do nothing;
    -- Tenant-only entry can resolve its first job before any profile is created.
    update public.initial_application_sessions set job_token=p_job_token
      where user_id=p_user_id and session_id=p_session_id and tenant_id=p_tenant_id and job_token=''
        and p_job_token is not null and expires_at>clock_timestamp()
        and not exists (select 1 from public.worker w where w.user_id=p_user_id and w.tenant_id=p_tenant_id);
  end if;
  select * into v from public.initial_application_sessions where user_id=p_user_id and session_id=p_session_id;
  if not found or v.expires_at <= clock_timestamp() or (p_tenant_id is not null and v.tenant_id <> p_tenant_id)
    or (p_job_token is not null and v.job_token <> p_job_token) then return false; end if;
  return not exists (
    select 1 from public.worker w join public.worker_onboarding_progress p on p.worker_id=w.id and p.tenant_id=w.tenant_id
    where w.user_id=p_user_id and w.tenant_id=v.tenant_id and (p.submitted_at is not null or p.completed_at is not null)
  ) and not exists (
    select 1 from public.job_applications a where a.applicant_auth_user_id=p_user_id and a.tenant_id=v.tenant_id and a.submitted_at is not null
  );
end;
$$;
revoke all on function public.check_initial_application_session(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.check_initial_application_session(uuid,uuid,uuid,text,boolean) to service_role;

-- Apply the same boundary to direct Data API and Storage access, not just the BFF.
create schema if not exists brass_private;
revoke all on schema brass_private from public,anon;
grant usage on schema brass_private to authenticated;
create or replace function brass_private.initial_application_access_allowed(p_tenant_id uuid default null, p_job_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select (not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and (
    not exists (select 1 from public.users u where u.id=(select auth.uid()) and (u.role not in ('candidate','worker') or u.god_admin))
    or exists (select 1 from public.staff_session_activity a where a.user_id=(select auth.uid())
      and a.session_id=((select auth.jwt())->>'session_id')::uuid and a.revoked_at is null
      and a.last_activity_at>now()-interval '30 minutes' and a.started_at>now()-interval '12 hours')
  )) or (coalesce((auth.jwt()->>'is_anonymous')::boolean,false) and exists (
    select 1 from public.initial_application_sessions s
    join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
    where s.user_id=(select auth.uid()) and s.session_id=((select auth.jwt())->>'session_id')::uuid
      and s.expires_at>now()
      and (p_tenant_id is null or s.tenant_id=p_tenant_id)
      and (p_job_id is null or exists (select 1 from public.job_requisitions j where j.id=p_job_id and j.tenant_id=s.tenant_id and j.public_job_token::text=s.job_token))
      and not exists (select 1 from public.worker w join public.worker_onboarding_progress p on p.worker_id=w.id and p.tenant_id=w.tenant_id
        where w.user_id=s.user_id and w.tenant_id=s.tenant_id and (p.submitted_at is not null or p.completed_at is not null))
      and not exists (select 1 from public.job_applications j where j.applicant_auth_user_id=s.user_id and j.tenant_id=s.tenant_id and j.submitted_at is not null)
  ));
$$;
revoke all on function brass_private.initial_application_access_allowed(uuid,uuid) from public,anon;
grant execute on function brass_private.initial_application_access_allowed(uuid,uuid) to authenticated;
do $$ declare t text; begin
  foreach t in array array['worker','job_applications','worker_documents','worker_submitted_documents','worker_portal_documents','worker_profession_document_uploads','worker_resumes','worker_onboarding_progress','worker_onboarding_step_progress'] loop
    execute format('create policy initial_application_session_boundary on public.%I as restrictive for all to authenticated using ((select brass_private.initial_application_access_allowed(tenant_id,%s))) with check ((select brass_private.initial_application_access_allowed(tenant_id,%s)))',t,case when t='job_applications' then 'job_requisition_id' else 'null' end,case when t='job_applications' then 'job_requisition_id' else 'null' end);
  end loop;
end $$;
create policy initial_application_session_boundary on storage.objects as restrictive for all to authenticated
  using ((select brass_private.initial_application_access_allowed())) with check ((select brass_private.initial_application_access_allowed()));
