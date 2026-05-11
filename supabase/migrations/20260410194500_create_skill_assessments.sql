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

