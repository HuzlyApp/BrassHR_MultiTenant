-- Rollback email domain migration using public.email_domain_migration_backup.
-- Run only if migration 20260611120000_migrate_nexusmedpro_to_brasshr_email_domain.sql was applied.
-- Prefer Supabase PITR restore for catastrophic failures; this script restores row values only.

BEGIN;

DO $$
DECLARE
  rec record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'email_domain_migration_backup'
  ) THEN
    RAISE EXCEPTION 'email_domain_migration_backup table not found — cannot rollback';
  END IF;

  FOR rec IN
    SELECT DISTINCT table_schema, table_name, column_name
    FROM public.email_domain_migration_backup
    ORDER BY table_schema, table_name, column_name
  LOOP
    IF rec.table_schema = 'auth' AND rec.table_name = 'users' THEN
      IF rec.column_name = 'email' THEN
        UPDATE auth.users u
        SET email = b.old_value
        FROM public.email_domain_migration_backup b
        WHERE b.table_schema = 'auth' AND b.table_name = 'users' AND b.column_name = 'email'
          AND b.row_id = u.id::text;
      ELSIF rec.column_name = 'email_change' THEN
        UPDATE auth.users u
        SET email_change = b.old_value
        FROM public.email_domain_migration_backup b
        WHERE b.table_schema = 'auth' AND b.table_name = 'users' AND b.column_name = 'email_change'
          AND b.row_id = u.id::text;
      END IF;
    ELSIF rec.table_schema = 'auth' AND rec.table_name = 'identities' THEN
      IF rec.column_name = 'email' THEN
        UPDATE auth.identities i
        SET email = b.old_value
        FROM public.email_domain_migration_backup b
        WHERE b.table_schema = 'auth' AND b.table_name = 'identities' AND b.column_name = 'email'
          AND b.row_id = i.id::text;
      ELSIF rec.column_name = 'identity_data.email' THEN
        UPDATE auth.identities i
        SET identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(b.old_value))
        FROM public.email_domain_migration_backup b
        WHERE b.table_schema = 'auth' AND b.table_name = 'identities'
          AND b.column_name = 'identity_data.email'
          AND b.row_id = i.id::text;
      END IF;
    ELSIF rec.table_schema = 'public' THEN
      EXECUTE format(
        'UPDATE public.%I t SET %I = b.old_value FROM public.email_domain_migration_backup b
         WHERE b.table_schema = %L AND b.table_name = %L AND b.column_name = %L AND b.row_id = t.id::text',
        rec.table_name, rec.column_name, rec.table_schema, rec.table_name, rec.column_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

-- After rollback, re-run scripts/email-domain-migration-validate.sql to confirm legacy counts restored.
