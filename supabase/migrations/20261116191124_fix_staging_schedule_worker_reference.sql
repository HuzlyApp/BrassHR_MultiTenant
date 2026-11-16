-- Staging integration regression: v1 assigns worker profile IDs, while legacy
-- assignments may contain auth-user IDs. The existing scope trigger supports both.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $fix$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.worker_shift_assignments'::regclass
      AND tgname='trg_fsd_assignment_scope' AND tgenabled='O' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Tenant assignment validation trigger must be enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.worker_shift_assignments'::regclass
      AND conname='worker_shift_assignments_worker_id_fkey' AND confrelid='auth.users'::regclass
  ) THEN
    ALTER TABLE public.worker_shift_assignments DROP CONSTRAINT worker_shift_assignments_worker_id_fkey;
  END IF;
END;
$fix$;
-- Match main's native UUID default rather than the equivalent extension function.
ALTER TABLE public.zoho_webhook_events ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
COMMIT;

