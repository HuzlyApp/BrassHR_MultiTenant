-- Adds a simple status field used by the admin recruiter pipeline.
-- Values: new | pending | approved | disapproved

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

-- Keep values constrained (safe even if column already existed without constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'worker_status_chk'
  ) THEN
    ALTER TABLE public.worker
      ADD CONSTRAINT worker_status_chk
      CHECK (status IN ('new','pending','approved','disapproved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_status_idx ON public.worker (status);

