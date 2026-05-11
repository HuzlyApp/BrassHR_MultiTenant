-- 1) Point any normalized answer rows at the canonical (min id) question per (category_id, quiz_number)
update public.applicant_skill_assessment_answers a
set skill_id = k.keeper
from (
  select distinct on (category_id, quiz_number)
    category_id,
    quiz_number,
    id as keeper
  from public.skill_questions
  where category_id = '880c1f95-f033-4ab7-9b5f-1721564901b0'::uuid
    and quiz_number is not null
  order by category_id, quiz_number, id
) k
join public.skill_questions sq
  on sq.category_id = k.category_id
 and sq.quiz_number = k.quiz_number
 and sq.id <> k.keeper
where a.skill_id = sq.id;

-- 2) Remove duplicate basic-care skill_questions (keep smallest id per quiz_number)
delete from public.skill_questions sq
where sq.category_id = '880c1f95-f033-4ab7-9b5f-1721564901b0'::uuid
  and exists (
    select 1
    from public.skill_questions sq2
    where sq2.category_id = sq.category_id
      and sq2.quiz_number is not distinct from sq.quiz_number
      and sq2.id < sq.id
  );

-- 3) Documentation: ensure quiz_number 8–10 exist (matches app catalog)
insert into public.skill_questions (id, category_id, question, quiz_number)
select gen_random_uuid(), '089c06cc-7ce2-446b-9f56-1c7a9cb068fd'::uuid, v.question, v.quiz_number
from (
  values
    (8, 'Urine test for glucose/ acetone'),
    (9, 'Transfer/ transport patients: gurney'),
    (10, 'Traction')
) as v(quiz_number, question)
where not exists (
  select 1
  from public.skill_questions sq
  where sq.category_id = '089c06cc-7ce2-446b-9f56-1c7a9cb068fd'::uuid
    and sq.quiz_number = v.quiz_number
);

-- 4) Prevent future duplicate rows per category + quiz_number
create unique index if not exists skill_questions_category_id_quiz_number_uidx
  on public.skill_questions (category_id, quiz_number)
  where quiz_number is not null;

-- 5) FK: persisted skill_id must reference skill_questions
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'applicant_skill_assessment_answers_skill_id_fkey'
  ) then
    alter table public.applicant_skill_assessment_answers
      add constraint applicant_skill_assessment_answers_skill_id_fkey
      foreign key (skill_id) references public.skill_questions (id) on delete cascade;
  end if;
end $$;
