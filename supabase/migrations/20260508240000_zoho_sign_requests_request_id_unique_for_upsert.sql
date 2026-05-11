-- PostgREST/Supabase upsert(onConflict: "request_id") needs a non-partial UNIQUE on request_id.

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where n.nspname = 'public'
      and t.relname = 'zoho_sign_requests'
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'request_id'
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'zoho_sign_requests'
      and indexname = 'zoho_sign_requests_request_id_uidx'
  ) then
    return;
  end if;

  drop index if exists public.zoho_sign_requests_request_id_idx;

  create unique index zoho_sign_requests_request_id_uidx
    on public.zoho_sign_requests (request_id);
end $$;
