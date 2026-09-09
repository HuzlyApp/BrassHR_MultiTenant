-- One active verification note per match-analysis requirement.
-- Keep the latest note when duplicates exist, then enforce uniqueness.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY requirement_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.job_application_match_requirement_notes
  WHERE deleted_at IS NULL
)
UPDATE public.job_application_match_requirement_notes AS notes
SET
  deleted_at = now(),
  updated_at = now()
FROM ranked
WHERE notes.id = ranked.id
  AND ranked.rn > 1
  AND notes.deleted_at IS NULL;

DROP INDEX IF EXISTS public.job_application_match_requirement_notes_one_active_per_req;
CREATE UNIQUE INDEX job_application_match_requirement_notes_one_active_per_req
  ON public.job_application_match_requirement_notes (requirement_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.job_application_match_requirement_notes_one_active_per_req IS
  'Each match requirement may have only one active verification note.';
