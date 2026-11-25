-- Directory role separates employment workers from people shown on the Managers list.
-- Promoting a worker sets directory_role = 'manager' so they leave Workers and appear on Managers.

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS directory_role text NOT NULL DEFAULT 'worker';

ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_directory_role_check;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_directory_role_check
  CHECK (directory_role IN ('worker', 'manager'));

COMMENT ON COLUMN public.workers.directory_role IS
  'Employment directory bucket: worker (Workers list) or manager (Managers list).';

CREATE INDEX IF NOT EXISTS workers_tenant_directory_role_idx
  ON public.workers (tenant_id, directory_role);
