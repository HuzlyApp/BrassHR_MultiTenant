-- Extra applicant profile fields for admin "Add candidate" (phone, address, employment, resume).

ALTER TABLE public.applicant_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS city_state_zip text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS last_job_title text,
  ADD COLUMN IF NOT EXISTS last_company text,
  ADD COLUMN IF NOT EXISTS resume_path text,
  ADD COLUMN IF NOT EXISTS resume_file_name text;

COMMENT ON COLUMN public.applicant_profiles.phone IS
  'Candidate phone collected via public apply or admin Add candidate.';
COMMENT ON COLUMN public.applicant_profiles.street_address IS
  'Street address from admin Add candidate (optional).';
COMMENT ON COLUMN public.applicant_profiles.city_state_zip IS
  'City/state/zip from admin Add candidate (optional).';
COMMENT ON COLUMN public.applicant_profiles.country IS
  'Country from admin Add candidate (optional).';
COMMENT ON COLUMN public.applicant_profiles.last_job_title IS
  'Most recent job title from admin Add candidate (optional).';
COMMENT ON COLUMN public.applicant_profiles.last_company IS
  'Most recent company from admin Add candidate (optional).';
COMMENT ON COLUMN public.applicant_profiles.resume_path IS
  'Storage object path for an admin-uploaded or linked resume (bucket worker-resumes).';
COMMENT ON COLUMN public.applicant_profiles.resume_file_name IS
  'Original resume file name for display.';

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS created_by_staff_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.job_applications
SET source = 'applicant'
WHERE source IS NULL;

ALTER TABLE public.job_applications
  ALTER COLUMN source SET DEFAULT 'applicant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_applications_source_chk'
      AND conrelid = 'public.job_applications'::regclass
  ) THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_source_chk
      CHECK (source IS NULL OR source IN ('applicant', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_applications.created_by_staff_user_id IS
  'Staff user who created the application via admin Add candidate (null for self-apply).';
COMMENT ON COLUMN public.job_applications.source IS
  'How the application was created: applicant (public apply) or admin (recruiter Add candidate).';
