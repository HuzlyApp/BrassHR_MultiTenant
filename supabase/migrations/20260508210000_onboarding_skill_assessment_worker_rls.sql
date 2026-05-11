-- Fix skill save: worker select/update failed under RLS (tenant_isolation depends on current_tenant_id(),
-- which read public.users and re-triggered tenant RLS — and anon applicants may have no users row).

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

-- Normalized quiz answers — same denial issue when RLS on and no tenant-safe policies here.
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
