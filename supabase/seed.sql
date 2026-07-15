-- Development seed only. NEVER apply this file to production.
-- Loaded by `supabase db reset` / local Docker only (see config.toml [db.seed]).
--
-- Contains anonymized fake tenants for UI testing. No production PII.

-- Safe no-op when run against empty/local: real bootstrap uses scripts/bootstrap-multi-tenant-seed.mjs
-- with the DEVELOPMENT service role key.

SELECT 'brasshr_dev_seed_placeholder' AS notice
WHERE current_setting('application_name', true) IS DISTINCT FROM 'production_guard';
