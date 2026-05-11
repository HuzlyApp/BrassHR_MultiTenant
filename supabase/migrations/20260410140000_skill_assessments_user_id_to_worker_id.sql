-- Rename legacy column if present (app code uses worker_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_assessments'
      AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_assessments'
      AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE public.skill_assessments RENAME COLUMN user_id TO worker_id;
  END IF;
END $$;
