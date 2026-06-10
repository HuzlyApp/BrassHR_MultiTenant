-- Email domain migration: @nexusmedpro.com → @brasshr.com
--
-- REVIEW BEFORE APPLYING:
--   1. Run scripts/email-domain-migration-validate.sql (pre-check counts)
--   2. Take a Supabase backup / PITR snapshot
--   3. Apply this migration in a maintenance window
--   4. Run scripts/email-domain-migration-validate.sql (post-check; expect 0 legacy rows)
--   5. Rollback: scripts/email-domain-migration-rollback.sql (uses email_domain_migration_backup)
--
-- Affected columns (public + auth):
--   auth.users.email, auth.users.email_change
--   auth.identities.email, auth.identities.identity_data->>'email'
--   public.users.email
--   public.worker.email
--   public.applicants.email
--   public.tenants.email
--   public.tenants.domain (*.nexusmedpro.com hostnames)
--   public.worker_references.reference_email
--   public.zoho_sign_requests.email
--   public.documents.signer_email
--   public.candidate_communications.recipient (email channel rows only)
--   public.email_templates.from_email, public.email_templates.reply_to_email

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_domain_migration_backup (
  id bigserial PRIMARY KEY,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  table_schema text NOT NULL,
  table_name text NOT NULL,
  column_name text NOT NULL,
  row_id text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL
);

COMMENT ON TABLE public.email_domain_migration_backup IS
  'Row-level backup for nexusmedpro.com → brasshr.com email/domain migration. Used by scripts/email-domain-migration-rollback.sql.';

CREATE OR REPLACE FUNCTION public._migrate_email_domain_nexus_to_brass(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input IS NULL OR length(trim(input)) = 0 THEN input
    WHEN lower(trim(input)) LIKE '%@nexusmedpro.com' THEN
      regexp_replace(lower(trim(input)), '@nexusmedpro\.com$', '@brasshr.com')
    ELSE input
  END
$$;

CREATE OR REPLACE FUNCTION public._migrate_hostname_nexus_to_brass(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN input IS NULL OR length(trim(input)) = 0 THEN input
    WHEN lower(trim(input)) LIKE '%.nexusmedpro.com' THEN
      regexp_replace(lower(trim(input)), '\.nexusmedpro\.com$', '.brasshr.com')
    ELSE input
  END
$$;

-- auth.users
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'auth', 'users', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM auth.users
WHERE lower(email) LIKE '%@nexusmedpro.com';

UPDATE auth.users
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(email) LIKE '%@nexusmedpro.com';

INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'auth', 'users', 'email_change', id::text, email_change, public._migrate_email_domain_nexus_to_brass(email_change)
FROM auth.users
WHERE lower(coalesce(email_change, '')) LIKE '%@nexusmedpro.com';

UPDATE auth.users
SET email_change = public._migrate_email_domain_nexus_to_brass(email_change)
WHERE lower(coalesce(email_change, '')) LIKE '%@nexusmedpro.com';

-- auth.identities
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'auth', 'identities', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM auth.identities
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

UPDATE auth.identities
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'auth', 'identities', 'identity_data.email', id::text,
  identity_data->>'email',
  public._migrate_email_domain_nexus_to_brass(identity_data->>'email')
FROM auth.identities
WHERE lower(coalesce(identity_data->>'email', '')) LIKE '%@nexusmedpro.com';

UPDATE auth.identities
SET identity_data = jsonb_set(
  identity_data,
  '{email}',
  to_jsonb(public._migrate_email_domain_nexus_to_brass(identity_data->>'email'))
)
WHERE lower(coalesce(identity_data->>'email', '')) LIKE '%@nexusmedpro.com';

-- public.users
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'users', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM public.users
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.users
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

-- public.worker
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'worker', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM public.worker
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.worker
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

-- public.applicants
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'applicants', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM public.applicants
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.applicants
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

-- public.tenants (contact email + vanity hostname)
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'tenants', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM public.tenants
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.tenants
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(coalesce(email, '')) LIKE '%@nexusmedpro.com';

INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'tenants', 'domain', id::text, domain, public._migrate_hostname_nexus_to_brass(domain)
FROM public.tenants
WHERE lower(coalesce(domain, '')) LIKE '%.nexusmedpro.com';

UPDATE public.tenants
SET domain = public._migrate_hostname_nexus_to_brass(domain)
WHERE lower(coalesce(domain, '')) LIKE '%.nexusmedpro.com';

-- public.worker_references
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'worker_references', 'reference_email', id::text, reference_email,
  public._migrate_email_domain_nexus_to_brass(reference_email)
FROM public.worker_references
WHERE lower(reference_email) LIKE '%@nexusmedpro.com';

UPDATE public.worker_references
SET reference_email = public._migrate_email_domain_nexus_to_brass(reference_email)
WHERE lower(reference_email) LIKE '%@nexusmedpro.com';

-- public.zoho_sign_requests
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'zoho_sign_requests', 'email', id::text, email, public._migrate_email_domain_nexus_to_brass(email)
FROM public.zoho_sign_requests
WHERE lower(email) LIKE '%@nexusmedpro.com';

UPDATE public.zoho_sign_requests
SET email = public._migrate_email_domain_nexus_to_brass(email)
WHERE lower(email) LIKE '%@nexusmedpro.com';

-- public.documents
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'documents', 'signer_email', id::text, signer_email,
  public._migrate_email_domain_nexus_to_brass(signer_email)
FROM public.documents
WHERE lower(coalesce(signer_email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.documents
SET signer_email = public._migrate_email_domain_nexus_to_brass(signer_email)
WHERE lower(coalesce(signer_email, '')) LIKE '%@nexusmedpro.com';

-- public.candidate_communications (email channel only; SMS recipients unchanged)
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'candidate_communications', 'recipient', id::text, recipient,
  public._migrate_email_domain_nexus_to_brass(recipient)
FROM public.candidate_communications
WHERE channel = 'email'
  AND lower(recipient) LIKE '%@nexusmedpro.com';

UPDATE public.candidate_communications
SET recipient = public._migrate_email_domain_nexus_to_brass(recipient)
WHERE channel = 'email'
  AND lower(recipient) LIKE '%@nexusmedpro.com';

-- public.email_templates
INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'email_templates', 'from_email', id::text, from_email,
  public._migrate_email_domain_nexus_to_brass(from_email)
FROM public.email_templates
WHERE lower(coalesce(from_email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.email_templates
SET from_email = public._migrate_email_domain_nexus_to_brass(from_email)
WHERE lower(coalesce(from_email, '')) LIKE '%@nexusmedpro.com';

INSERT INTO public.email_domain_migration_backup (table_schema, table_name, column_name, row_id, old_value, new_value)
SELECT 'public', 'email_templates', 'reply_to_email', id::text, reply_to_email,
  public._migrate_email_domain_nexus_to_brass(reply_to_email)
FROM public.email_templates
WHERE lower(coalesce(reply_to_email, '')) LIKE '%@nexusmedpro.com';

UPDATE public.email_templates
SET reply_to_email = public._migrate_email_domain_nexus_to_brass(reply_to_email)
WHERE lower(coalesce(reply_to_email, '')) LIKE '%@nexusmedpro.com';

COMMENT ON COLUMN public.tenants.subdomain IS
  'Single DNS label under ROOT_DOMAIN (e.g. clinic1 → clinic1.brasshr.com).';

COMMIT;
