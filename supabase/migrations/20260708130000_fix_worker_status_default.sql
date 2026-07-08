-- Fix legacy default `status = 'Active'` which violates worker_status_chk (lowercase only).

UPDATE public.worker
SET status = 'new'
WHERE status = 'Active';

UPDATE public.worker
SET status = lower(trim(status))
WHERE status IS NOT NULL
  AND status <> lower(trim(status))
  AND lower(trim(status)) IN (
    'new', 'pending', 'approved', 'disapproved', 'converted', 'under_review',
    'for_approval', 'active', 'inactive', 'cancelled', 'banned'
  );

ALTER TABLE public.worker
  ALTER COLUMN status SET DEFAULT 'new';
