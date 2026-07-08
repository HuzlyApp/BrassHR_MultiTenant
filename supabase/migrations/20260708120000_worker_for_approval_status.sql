-- Add for_approval pipeline status and backfill candidates ready for final approval.

-- Normalize legacy Title-Case employment labels so the check constraint can be recreated.
UPDATE public.worker
SET status = lower(trim(status))
WHERE status IS NOT NULL
  AND status ~ '[A-Z]'
  AND lower(trim(status)) IN (
    'new', 'pending', 'approved', 'disapproved', 'converted', 'under_review',
    'for_approval', 'active', 'inactive', 'cancelled', 'banned'
  );

ALTER TABLE public.worker DROP CONSTRAINT IF EXISTS worker_status_chk;

ALTER TABLE public.worker
  ADD CONSTRAINT worker_status_chk
  CHECK (
    status IS NULL
    OR status IN (
      'new',
      'pending',
      'approved',
      'disapproved',
      'converted',
      'under_review',
      'for_approval',
      'active',
      'inactive',
      'cancelled',
      'banned'
    )
  );

-- Backfill: candidates with Final Approval prerequisites (call_1, call_2, references)
-- still stuck in early statuses. Skill assessments are enforced in app promotion logic.
WITH ready AS (
  SELECT w.id
  FROM public.worker w
  WHERE COALESCE(lower(trim(w.status)), 'new') IN ('new', 'pending', 'under_review')
    AND EXISTS (
      SELECT 1
      FROM public.worker_pipeline_checklist_items c1
      WHERE c1.worker_id = w.id
        AND c1.item_key = 'call_1'
        AND (c1.manual_completed IS TRUE OR c1.call_log_completed IS TRUE)
    )
    AND EXISTS (
      SELECT 1
      FROM public.worker_pipeline_checklist_items c2
      WHERE c2.worker_id = w.id
        AND c2.item_key = 'call_2'
        AND (c2.manual_completed IS TRUE OR c2.call_log_completed IS TRUE)
    )
    AND EXISTS (
      SELECT 1
      FROM public.worker_references wr
      WHERE wr.worker_id = w.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.workers emp
      WHERE emp.candidate_id = w.id
    )
)
UPDATE public.worker w
SET
  status = 'for_approval',
  updated_at = now()
FROM ready
WHERE w.id = ready.id;

-- Candidates already linked to an employment worker row should be marked converted.
UPDATE public.worker w
SET
  status = 'converted',
  updated_at = now()
FROM public.workers emp
WHERE emp.candidate_id = w.id
  AND COALESCE(lower(trim(w.status)), '') <> 'converted'
  AND COALESCE(lower(trim(w.status)), '') <> 'disapproved';
