-- Tenant-specific presentation data; existing tenant isolation policies still apply.
alter table public.tenant_industry
  add column description text check (char_length(description) <= 100),
  add column icon_id text check (char_length(icon_id) <= 32);
