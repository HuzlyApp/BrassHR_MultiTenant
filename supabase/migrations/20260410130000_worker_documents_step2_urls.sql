-- Step 2 (license / TB / CPR) + identity URLs on one row per worker.
-- Run in Supabase SQL editor if you do not use CLI migrations.

ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS nursing_license_url text,
  ADD COLUMN IF NOT EXISTS tb_test_url text,
  ADD COLUMN IF NOT EXISTS cpr_certification_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Enables upsert on worker_id (PostgreSQL treats NULLs as distinct; ensure one row per worker in app).
CREATE UNIQUE INDEX IF NOT EXISTS worker_documents_worker_id_uidx ON public.worker_documents (worker_id);

-- Optional: enforce FK after backfill
-- ALTER TABLE public.worker_documents
--   ADD CONSTRAINT worker_documents_worker_id_fkey
--   FOREIGN KEY (worker_id) REFERENCES public.worker (id) ON DELETE CASCADE;
