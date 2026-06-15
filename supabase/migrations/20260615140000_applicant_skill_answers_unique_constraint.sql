-- Required for PostgREST upsert: on_conflict=applicant_id,category_id,skill_id
-- Some remote DBs were created before the inline UNIQUE on the create-table migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applicant_skill_assessment_answers_applicant_id_category_id_skill_id_key'
      AND conrelid = 'public.applicant_skill_assessment_answers'::regclass
  ) THEN
    ALTER TABLE public.applicant_skill_assessment_answers
      ADD CONSTRAINT applicant_skill_assessment_answers_applicant_id_category_id_skill_id_key
      UNIQUE (applicant_id, category_id, skill_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS applicant_skill_assessment_answers_applicant_category_skill_uidx
  ON public.applicant_skill_assessment_answers (applicant_id, category_id, skill_id);
