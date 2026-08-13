-- Correct pending/in_progress backfill ranking for Parameterized Job Application.
-- Rank among ALL progress steps so step_number matches the applicant stepper index.

WITH all_ranked AS (
  SELECT
    sp.id AS step_progress_id,
    sp.status,
    p.farthest_reached_step_index,
    tos.metadata->>'workflow_step_id' AS workflow_step_id,
    ROW_NUMBER() OVER (
      PARTITION BY sp.worker_onboarding_progress_id
      ORDER BY tos.sort_order ASC, tos.created_at ASC NULLS LAST, tos.id ASC
    ) AS step_number
  FROM public.worker_onboarding_step_progress sp
  JOIN public.worker_onboarding_progress p
    ON p.id = sp.worker_onboarding_progress_id
  JOIN public.tenant_onboarding_steps tos
    ON tos.id = sp.onboarding_step_id
),
ranked AS (
  SELECT *
  FROM all_ranked
  WHERE workflow_step_id = 'parameterized-job-application'
    AND status IN ('pending', 'in_progress')
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
