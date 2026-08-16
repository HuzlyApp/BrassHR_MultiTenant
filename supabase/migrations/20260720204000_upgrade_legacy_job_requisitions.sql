-- Add columns expected by the public jobs portal and recruiter job APIs on legacy
-- job_requisitions tables (CREATE TABLE IF NOT EXISTS skipped existing schemas).

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS internal_requisition_number text,
  ADD COLUMN IF NOT EXISTS external_requisition_id text,
  ADD COLUMN IF NOT EXISTS msp_client text,
  ADD COLUMN IF NOT EXISTS profession_id uuid REFERENCES public.professions (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.specialties (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS employer_of_record text,
  ADD COLUMN IF NOT EXISTS facility text,
  ADD COLUMN IF NOT EXISTS pay_rate_min numeric(12, 2),
  ADD COLUMN IF NOT EXISTS pay_rate_max numeric(12, 2),
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS public_title text,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS schedule text,
  ADD COLUMN IF NOT EXISTS responsibilities text,
  ADD COLUMN IF NOT EXISTS benefits text,
  ADD COLUMN IF NOT EXISTS application_deadline date,
  ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.job_requisitions
SET
  internal_requisition_number = COALESCE(internal_requisition_number, job_number),
  external_requisition_id = COALESCE(external_requisition_id, external_req_id),
  msp_client = COALESCE(msp_client, msp_client_name),
  facility = COALESCE(facility, facility_name),
  pay_rate_min = COALESCE(pay_rate_min, pay_rate),
  pay_rate_max = COALESCE(pay_rate_max, pay_rate),
  duration = COALESCE(duration, job_duration),
  public_title = COALESCE(public_title, title),
  public_description = COALESCE(public_description, description),
  benefits = COALESCE(benefits, benefits_summary),
  workflow_id = COALESCE(workflow_id, workflow_template_id)
WHERE
  internal_requisition_number IS NULL
  OR external_requisition_id IS NULL
  OR msp_client IS NULL
  OR facility IS NULL
  OR pay_rate_min IS NULL
  OR pay_rate_max IS NULL
  OR duration IS NULL
  OR public_title IS NULL
  OR public_description IS NULL
  OR benefits IS NULL
  OR workflow_id IS NULL;

UPDATE public.job_requisitions j
SET profession_id = p.id
FROM public.professions p
WHERE j.profession_id IS NULL
  AND j.profession IS NOT NULL
  AND lower(trim(j.profession)) = lower(trim(p.name))
  AND (p.tenant_id IS NULL OR p.tenant_id = j.tenant_id);

UPDATE public.job_requisitions j
SET specialty_id = s.id
FROM public.specialties s
WHERE j.specialty_id IS NULL
  AND j.specialty IS NOT NULL
  AND lower(trim(j.specialty)) = lower(trim(s.name))
  AND (s.tenant_id IS NULL OR s.tenant_id = j.tenant_id)
  AND (j.profession_id IS NULL OR s.profession_id = j.profession_id);

-- Allow lowercase statuses used by the new recruiter APIs alongside legacy values.
ALTER TABLE public.job_requisitions
  DROP CONSTRAINT IF EXISTS job_requisitions_status_check;

ALTER TABLE public.job_requisitions
  ADD CONSTRAINT job_requisitions_status_check CHECK (
    status = ANY (
      ARRAY[
        'draft',
        'published',
        'closed',
        'archived',
        'Draft',
        'Pending_Approval',
        'Approved',
        'Published',
        'Paused',
        'Closed',
        'Filled',
        'Cancelled',
        'Open'
      ]::text[]
    )
  );

CREATE INDEX IF NOT EXISTS job_requisitions_public_search_idx
  ON public.job_requisitions (tenant_id, published_at DESC)
  WHERE status IN ('published', 'Published', 'Open');

CREATE INDEX IF NOT EXISTS job_requisitions_workflow_idx
  ON public.job_requisitions (tenant_id, workflow_id);

-- Applicant tables required by apply/start-application flows.
CREATE TABLE IF NOT EXISTS public.applicant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  email text,
  normalized_email text,
  first_name text,
  last_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_profiles_email_normalized_chk CHECK (
    normalized_email IS NULL OR normalized_email = lower(trim(normalized_email))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS applicant_profiles_tenant_email_uidx
  ON public.applicant_profiles (tenant_id, normalized_email)
  WHERE normalized_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS applicant_profiles_tenant_auth_uidx
  ON public.applicant_profiles (tenant_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS applicant_profiles_tenant_worker_uidx
  ON public.applicant_profiles (tenant_id, worker_id)
  WHERE worker_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_requisition_id uuid NOT NULL REFERENCES public.job_requisitions (id) ON DELETE RESTRICT,
  applicant_profile_id uuid REFERENCES public.applicant_profiles (id) ON DELETE RESTRICT,
  applicant_auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  workflow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  applicant_workflow_instance_id uuid,
  status text NOT NULL DEFAULT 'in_progress',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_applications_status_chk CHECK (
    status IN ('in_progress', 'submitted', 'withdrawn', 'rejected', 'hired')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_profile_uidx
  ON public.job_applications (tenant_id, job_requisition_id, applicant_profile_id)
  WHERE applicant_profile_id IS NOT NULL AND status <> 'withdrawn';
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_job_auth_uidx
  ON public.job_applications (tenant_id, job_requisition_id, applicant_auth_user_id)
  WHERE applicant_auth_user_id IS NOT NULL AND status <> 'withdrawn';
CREATE INDEX IF NOT EXISTS job_applications_job_status_idx
  ON public.job_applications (tenant_id, job_requisition_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.applicant_workflow_step_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  workflow_instance_id uuid NOT NULL REFERENCES public.applicant_workflow_instances (id) ON DELETE CASCADE,
  snapshot_step_id text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  step_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_workflow_step_records_status_chk CHECK (
    status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')
  ),
  CONSTRAINT applicant_workflow_step_records_instance_position_uidx
    UNIQUE (workflow_instance_id, position)
);

DROP POLICY IF EXISTS job_requisitions_public_read ON public.job_requisitions;
CREATE POLICY job_requisitions_public_read ON public.job_requisitions
  FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'Published', 'Open'));

GRANT SELECT (
  id,
  tenant_id,
  profession_id,
  specialty_id,
  employment_type,
  public_title,
  public_description,
  location,
  schedule,
  pay_rate_min,
  pay_rate_max,
  qualifications,
  responsibilities,
  benefits,
  application_deadline,
  public_job_token,
  published_at,
  created_at,
  updated_at
) ON public.job_requisitions TO anon, authenticated;

ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_workflow_step_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS applicant_profiles_staff ON public.applicant_profiles;
CREATE POLICY applicant_profiles_staff ON public.applicant_profiles
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS applicant_profiles_self ON public.applicant_profiles;
CREATE POLICY applicant_profiles_self ON public.applicant_profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS job_applications_staff ON public.job_applications;
CREATE POLICY job_applications_staff ON public.job_applications
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS job_applications_self ON public.job_applications;
CREATE POLICY job_applications_self ON public.job_applications
  FOR SELECT TO authenticated
  USING (applicant_auth_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_workflow_step_records TO authenticated;
GRANT ALL ON public.applicant_profiles, public.job_applications, public.applicant_workflow_step_records TO service_role;
