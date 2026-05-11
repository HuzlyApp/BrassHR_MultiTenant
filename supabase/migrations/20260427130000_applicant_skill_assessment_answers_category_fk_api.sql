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
