-- PostgREST onConflict cannot infer partial unique indexes without a matching WHERE clause.
-- Use a full unique index on (application_id, onboarding_step_id).
-- PostgreSQL NULLS DISTINCT still allows multiple rows with NULL application_id.

DROP INDEX IF EXISTS public.worker_firma_signing_sessions_application_step_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS worker_firma_signing_sessions_application_step_uidx
  ON public.worker_firma_signing_sessions (application_id, onboarding_step_id);

COMMENT ON INDEX public.worker_firma_signing_sessions_application_step_uidx IS
  'Unique Firma signing session per application + onboarding step. Required for PostgREST upsert onConflict.';
