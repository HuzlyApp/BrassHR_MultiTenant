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

