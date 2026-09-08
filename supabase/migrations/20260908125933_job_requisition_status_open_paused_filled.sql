-- Canonical job_requisitions.status (lowercase):
--   draft | open | paused | filled | closed | archived
-- Replaces "published" with "open" and promotes Paused/Filled to first-class values.

ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_status_check;

-- Prefer text + CHECK over enum so new statuses are easy to extend.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'job_requisitions'
      AND a.attname = 'status'
      AND NOT a.attisdropped
      AND t.typtype = 'e'
  ) THEN
    ALTER TABLE public.job_requisitions
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.job_requisitions
      ALTER COLUMN status TYPE text USING status::text;
  END IF;
END $$;

UPDATE public.job_requisitions
SET status = CASE lower(replace(trim(status::text), ' ', '_'))
  WHEN 'published' THEN 'open'
  WHEN 'open' THEN 'open'
  WHEN 'paused' THEN 'paused'
  WHEN 'filled' THEN 'filled'
  WHEN 'closed' THEN 'closed'
  WHEN 'cancelled' THEN 'closed'
  WHEN 'archived' THEN 'archived'
  WHEN 'draft' THEN 'draft'
  WHEN 'pending_approval' THEN 'draft'
  WHEN 'approved' THEN 'draft'
  ELSE lower(replace(trim(status::text), ' ', '_'))
END
WHERE status IS NOT NULL;

-- Any unexpected leftover values fall back to draft so CHECK can be applied.
UPDATE public.job_requisitions
SET status = 'draft'
WHERE status IS NULL
   OR status NOT IN ('draft', 'open', 'paused', 'filled', 'closed', 'archived', 'published');

ALTER TABLE public.job_requisitions
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.job_requisitions
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_status_check CHECK (
    status = ANY (
      ARRAY[
        'draft',
        'open',
        'paused',
        'filled',
        'closed',
        'archived',
        -- Legacy alias kept only for safe dual-read during rollout.
        'published'
      ]::text[]
    )
  );

DROP INDEX IF EXISTS public.job_requisitions_public_search_idx;

CREATE INDEX IF NOT EXISTS job_requisitions_public_search_idx
  ON public.job_requisitions (tenant_id, published_at DESC)
  WHERE status IN ('open', 'published');

COMMENT ON COLUMN public.job_requisitions.status IS
  'Job lifecycle: draft | open | paused | filled | closed | archived (legacy published maps to open).';
