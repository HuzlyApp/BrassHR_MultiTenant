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
