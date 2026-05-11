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

