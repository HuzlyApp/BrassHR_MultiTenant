-- Staff-created client organizations do not necessarily have a client login.
-- Preserve the unique login link and existing tenant isolation policy.
alter table public.clients alter column user_id drop not null;
