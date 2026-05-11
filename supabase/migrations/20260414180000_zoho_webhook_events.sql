-- Stores raw Zoho webhook deliveries for debugging + async processing.
-- Inserts are intended to be done via Supabase Edge Function using the service role key.

create table if not exists public.zoho_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),

  -- Best-effort idempotency key (header value or derived hash)
  event_id text not null,
  source text not null default 'zoho',

  method text,
  path text,
  query jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,

  -- Parsed JSON if available; otherwise null and raw_body will contain text.
  payload jsonb,
  raw_body text,

  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text
);

create unique index if not exists zoho_webhook_events_event_id_uidx
  on public.zoho_webhook_events (event_id);

create index if not exists zoho_webhook_events_received_at_idx
  on public.zoho_webhook_events (received_at desc);

alter table public.zoho_webhook_events enable row level security;

-- No policies by default. Service role bypasses RLS.

