-- Backfill: Parameterized Job Application placeholders were auto-marked `skipped`
-- by client non-navigable handlers. Required + skipped maps to the orange
-- required_missing indicator even after the applicant advanced past the step.
-- These rows were system advances (no applicant screen), not genuine skips.

UPDATE public.worker_onboarding_step_progress AS sp
SET
  status = 'completed',
  completed_at = COALESCE(sp.completed_at, sp.updated_at, now()),
  data = COALESCE(sp.data, '{}'::jsonb) || jsonb_build_object(
    'system_completed', true,
    'reason', 'non_navigable_placeholder_backfill',
    'upgraded_from', sp.status
  ),
  updated_at = now()
FROM public.tenant_onboarding_steps AS tos
WHERE sp.onboarding_step_id = tos.id
  AND tos.metadata->>'workflow_step_id' = 'parameterized-job-application'
  AND sp.status = 'skipped';

-- Also complete pending parameterized placeholders when the applicant has already
-- progressed past them (farthest_reached_step_index > this step's 1-based index).
-- NOTE: early ranking scoped only parameterized rows (always step_number=1). Fixed in
-- 20260813182542_fix_parameterized_pending_backfill_ranking.sql.
WITH ranked AS (
  SELECT
    sp.id AS step_progress_id,
    sp.status,
    p.farthest_reached_step_index,
    ROW_NUMBER() OVER (
      PARTITION BY sp.worker_onboarding_progress_id
      ORDER BY tos.sort_order ASC, tos.created_at ASC NULLS LAST, tos.id ASC
    ) AS step_number
  FROM public.worker_onboarding_step_progress sp
  JOIN public.worker_onboarding_progress p
    ON p.id = sp.worker_onboarding_progress_id
  JOIN public.tenant_onboarding_steps tos
    ON tos.id = sp.onboarding_step_id
  WHERE tos.metadata->>'workflow_step_id' = 'parameterized-job-application'
    AND sp.status IN ('pending', 'in_progress')
)
UPDATE public.worker_onboarding_step_progress AS sp
SET
  status = 'completed',
  completed_at = COALESCE(sp.completed_at, sp.updated_at, now()),
  data = COALESCE(sp.data, '{}'::jsonb) || jsonb_build_object(
    'system_completed', true,
    'reason', 'non_navigable_placeholder_backfill',
    'upgraded_from', ranked.status
  ),
  updated_at = now()
FROM ranked
WHERE sp.id = ranked.step_progress_id
  AND ranked.farthest_reached_step_index > ranked.step_number;
