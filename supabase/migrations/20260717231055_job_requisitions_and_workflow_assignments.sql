-- Job requisitions, deterministic workflow assignment, and per-application snapshots.
-- Matching key: profession_id + employment_type + placement_type.

DO $$ BEGIN
  CREATE TYPE public.job_requisition_status AS ENUM ('draft', 'published', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_employment_type AS ENUM ('W2', '1099', 'Contract');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_placement_type AS ENUM (
    'Internal',
    'Recruit_and_Release',
    'Recruit_and_EOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.job_source_type AS ENUM ('Internal', 'MSP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professions_code_not_empty CHECK (char_length(trim(code)) > 0),
  CONSTRAINT professions_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS professions_global_code_uidx
  ON public.professions (lower(code)) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professions_tenant_code_uidx
  ON public.professions (tenant_id, lower(code)) WHERE tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT specialties_code_not_empty CHECK (char_length(trim(code)) > 0),
  CONSTRAINT specialties_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS specialties_global_code_uidx
  ON public.specialties (profession_id, lower(code)) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS specialties_tenant_code_uidx
  ON public.specialties (tenant_id, profession_id, lower(code)) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS specialties_profession_idx
  ON public.specialties (profession_id, name) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.workflow_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions (id) ON DELETE RESTRICT,
  employment_type public.job_employment_type NOT NULL,
  placement_type public.job_placement_type NOT NULL,
  workflow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_mappings_active_criteria_uidx
  ON public.workflow_mappings (
    tenant_id,
    profession_id,
    employment_type,
    placement_type
  )
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS workflow_mappings_lookup_idx
  ON public.workflow_mappings (
    tenant_id,
    profession_id,
    employment_type,
    placement_type,
    priority
  )
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.job_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  internal_requisition_number text,
  external_requisition_id text,
  source_type public.job_source_type NOT NULL DEFAULT 'Internal',
  msp_client text,
  profession_id uuid NOT NULL REFERENCES public.professions (id) ON DELETE RESTRICT,
  specialty_id uuid REFERENCES public.specialties (id) ON DELETE RESTRICT,
  employment_type public.job_employment_type NOT NULL,
  placement_type public.job_placement_type NOT NULL,
  employer_of_record text,
  department text,
  facility text,
  bill_rate numeric(12,2),
  pay_rate_min numeric(12,2),
  pay_rate_max numeric(12,2),
  target_start_date date,
  duration text,
  shift_type text,
  shift_details text,
  hours_per_week numeric(6,2),
  public_title text,
  public_description text,
  location text,
  schedule text,
  qualifications text,
  responsibilities text,
  benefits text,
  application_deadline date,
  status public.job_requisition_status NOT NULL DEFAULT 'draft',
  workflow_id uuid REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  public_job_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  published_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_requisitions_public_token_unique UNIQUE (public_job_token),
  CONSTRAINT job_requisitions_pay_range_chk CHECK (
    pay_rate_min IS NULL OR pay_rate_max IS NULL OR pay_rate_min <= pay_rate_max
  ),
  CONSTRAINT job_requisitions_published_required_chk CHECK (
    status <> 'published'
    OR (
      workflow_id IS NOT NULL
      AND char_length(trim(COALESCE(public_title, ''))) > 0
      AND char_length(trim(COALESCE(public_description, ''))) > 0
      AND char_length(trim(COALESCE(location, ''))) > 0
    )
  ),
  CONSTRAINT job_requisitions_msp_required_chk CHECK (
    status <> 'published'
    OR source_type <> 'MSP'
    OR (
      char_length(trim(COALESCE(msp_client, ''))) > 0
      AND char_length(trim(COALESCE(external_requisition_id, ''))) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS job_requisitions_tenant_status_created_idx
  ON public.job_requisitions (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_requisitions_public_search_idx
  ON public.job_requisitions (tenant_id, published_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS job_requisitions_workflow_idx
  ON public.job_requisitions (tenant_id, workflow_id);

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

CREATE TABLE IF NOT EXISTS public.applicant_workflow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL UNIQUE REFERENCES public.job_applications (id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.onboarding_flows (id) ON DELETE RESTRICT,
  workflow_name text NOT NULL,
  workflow_snapshot jsonb NOT NULL,
  workflow_version text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applicant_workflow_instances_status_chk CHECK (
    status IN ('not_started', 'in_progress', 'completed', 'abandoned')
  )
);

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_workflow_instance_fkey;
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_workflow_instance_fkey
  FOREIGN KEY (applicant_workflow_instance_id)
  REFERENCES public.applicant_workflow_instances (id) ON DELETE SET NULL;

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

CREATE OR REPLACE FUNCTION public.user_is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = p_tenant_id
      AND ur.role::text = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u.god_admin = true
        OR (u.tenant_id = p_tenant_id AND u.role::text IN ('admin', 'owner'))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_tenant_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_is_tenant_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_job_workflow_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.specialty_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.specialties s
    WHERE s.id = NEW.specialty_id
      AND s.profession_id = NEW.profession_id
      AND (s.tenant_id IS NULL OR s.tenant_id = NEW.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Specialty does not belong to the selected profession and tenant';
  END IF;

  IF NEW.workflow_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_flows f
    WHERE f.id = NEW.workflow_id
      AND f.tenant_id = NEW.tenant_id
      AND f.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Assigned workflow must be published and belong to the job tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_requisitions_tenant_integrity ON public.job_requisitions;
CREATE TRIGGER trg_job_requisitions_tenant_integrity
BEFORE INSERT OR UPDATE ON public.job_requisitions
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_workflow_tenant();

CREATE OR REPLACE FUNCTION public.enforce_workflow_mapping_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_flows f
    WHERE f.id = NEW.workflow_id
      AND f.tenant_id = NEW.tenant_id
      AND f.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Mapped workflow must be published and belong to the mapping tenant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professions p
    WHERE p.id = NEW.profession_id
      AND p.is_active = true
      AND (p.tenant_id IS NULL OR p.tenant_id = NEW.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Profession is unavailable for the mapping tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_mappings_tenant_integrity ON public.workflow_mappings;
CREATE TRIGGER trg_workflow_mappings_tenant_integrity
BEFORE INSERT OR UPDATE ON public.workflow_mappings
FOR EACH ROW EXECUTE FUNCTION public.enforce_workflow_mapping_tenant();

CREATE OR REPLACE FUNCTION public.enforce_job_application_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.job_requisitions j
    WHERE j.id = NEW.job_requisition_id
      AND j.tenant_id = NEW.tenant_id
      AND j.workflow_id = NEW.workflow_id
      AND (TG_OP <> 'INSERT' OR j.status = 'published')
  ) THEN
    RAISE EXCEPTION 'Application job and workflow must belong to the tenant and accept applications';
  END IF;

  IF NEW.applicant_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.applicant_profiles p
    WHERE p.id = NEW.applicant_profile_id AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Applicant profile must belong to the application tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_applications_tenant_integrity ON public.job_applications;
CREATE TRIGGER trg_job_applications_tenant_integrity
BEFORE INSERT OR UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_job_application_tenant();

CREATE OR REPLACE FUNCTION public.enforce_workflow_instance_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.job_applications a
    WHERE a.id = NEW.application_id
      AND a.tenant_id = NEW.tenant_id
      AND a.workflow_id = NEW.workflow_id
  ) THEN
    RAISE EXCEPTION 'Workflow instance must match the application tenant and workflow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_applicant_workflow_instances_tenant_integrity
  ON public.applicant_workflow_instances;
CREATE TRIGGER trg_applicant_workflow_instances_tenant_integrity
BEFORE INSERT OR UPDATE ON public.applicant_workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.enforce_workflow_instance_tenant();

CREATE OR REPLACE FUNCTION public.set_jobs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_requisitions_updated_at ON public.job_requisitions;
CREATE TRIGGER trg_job_requisitions_updated_at
BEFORE UPDATE ON public.job_requisitions
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_updated_at();
DROP TRIGGER IF EXISTS trg_workflow_mappings_updated_at ON public.workflow_mappings;
CREATE TRIGGER trg_workflow_mappings_updated_at
BEFORE UPDATE ON public.workflow_mappings
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_updated_at();
DROP TRIGGER IF EXISTS trg_applicant_profiles_updated_at ON public.applicant_profiles;
CREATE TRIGGER trg_applicant_profiles_updated_at
BEFORE UPDATE ON public.applicant_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_updated_at();
DROP TRIGGER IF EXISTS trg_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER trg_job_applications_updated_at
BEFORE UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_updated_at();
DROP TRIGGER IF EXISTS trg_applicant_workflow_instances_updated_at ON public.applicant_workflow_instances;
CREATE TRIGGER trg_applicant_workflow_instances_updated_at
BEFORE UPDATE ON public.applicant_workflow_instances
FOR EACH ROW EXECUTE FUNCTION public.set_jobs_updated_at();

ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_workflow_step_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY professions_read ON public.professions FOR SELECT TO anon, authenticated
  USING (is_active AND (tenant_id IS NULL OR public.user_is_tenant_staff(tenant_id)));
CREATE POLICY professions_admin_write ON public.professions FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id));

CREATE POLICY specialties_read ON public.specialties FOR SELECT TO anon, authenticated
  USING (is_active AND (tenant_id IS NULL OR public.user_is_tenant_staff(tenant_id)));
CREATE POLICY specialties_admin_write ON public.specialties FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.user_is_tenant_admin(tenant_id));

CREATE POLICY workflow_mappings_staff_read ON public.workflow_mappings FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));
CREATE POLICY workflow_mappings_admin_write ON public.workflow_mappings FOR ALL TO authenticated
  USING (public.user_is_tenant_admin(tenant_id))
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

CREATE POLICY job_requisitions_public_read ON public.job_requisitions FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY job_requisitions_staff ON public.job_requisitions FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

CREATE POLICY applicant_profiles_staff ON public.applicant_profiles FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));
CREATE POLICY applicant_profiles_self ON public.applicant_profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY job_applications_staff ON public.job_applications FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));
CREATE POLICY job_applications_self ON public.job_applications FOR SELECT TO authenticated
  USING (applicant_auth_user_id = auth.uid());

CREATE POLICY applicant_workflow_instances_staff ON public.applicant_workflow_instances FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));
CREATE POLICY applicant_workflow_instances_self ON public.applicant_workflow_instances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.id = application_id AND a.applicant_auth_user_id = auth.uid()
    )
  );

CREATE POLICY applicant_workflow_step_records_staff ON public.applicant_workflow_step_records FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));
CREATE POLICY applicant_workflow_step_records_self ON public.applicant_workflow_step_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicant_workflow_instances wi
      JOIN public.job_applications a ON a.id = wi.application_id
      WHERE wi.id = workflow_instance_id AND a.applicant_auth_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.professions, public.specialties TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_mappings TO authenticated;
REVOKE ALL ON public.job_requisitions FROM anon, authenticated;
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
GRANT INSERT, UPDATE, DELETE ON public.job_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_workflow_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applicant_workflow_step_records TO authenticated;
GRANT ALL ON public.professions, public.specialties, public.workflow_mappings,
  public.job_requisitions, public.applicant_profiles, public.job_applications,
  public.applicant_workflow_instances, public.applicant_workflow_step_records TO service_role;

-- Global controlled values. Tenants may add scoped values through admin-only APIs later.
INSERT INTO public.professions (tenant_id, code, name)
VALUES
  (NULL, 'RN', 'Registered Nurse'),
  (NULL, 'LPN', 'Licensed Practical Nurse'),
  (NULL, 'CNA', 'Certified Nursing Assistant'),
  (NULL, 'ALLIED_HEALTH', 'Allied Health'),
  (NULL, 'ADMIN', 'Administrative')
ON CONFLICT DO NOTHING;

INSERT INTO public.specialties (tenant_id, profession_id, code, name)
SELECT NULL, p.id, v.code, v.name
FROM (
  VALUES
    ('RN', 'MED_SURG', 'Medical-Surgical'),
    ('RN', 'ICU', 'Intensive Care Unit'),
    ('RN', 'ER', 'Emergency Room'),
    ('RN', 'OR', 'Operating Room'),
    ('RN', 'HOME_HEALTH', 'Home Health'),
    ('LPN', 'LONG_TERM_CARE', 'Long-Term Care'),
    ('CNA', 'LONG_TERM_CARE', 'Long-Term Care')
) AS v(profession_code, code, name)
JOIN public.professions p ON p.tenant_id IS NULL AND p.code = v.profession_code
ON CONFLICT DO NOTHING;

-- Editable starting points. Copying a preset creates a separate tenant workflow.
INSERT INTO public.onboarding_templates (
  tenant_id, name, description, type, status, flow_name, builder_draft
)
SELECT
  NULL,
  v.name,
  v.description,
  'preset',
  'published',
  v.flow_name,
  v.builder_draft::jsonb
FROM (
  VALUES
    (
      'Default W2 Onboarding',
      'Editable W2 starting point with resume, employment documents, agreement, and review.',
      'W2 Onboarding',
      '{"nodes":[{"id":"w2-resume","stepId":"resume-basic-profile","label":"Upload Resume","description":"Upload resume and confirm contact information.","position":{"x":80,"y":80},"day":1,"required":true,"settings":{}},{"id":"w2-docs","stepId":"document-upload","label":"Employment Documents","description":"Upload required W2 employment documents.","position":{"x":80,"y":240},"day":1,"required":true,"settings":{}},{"id":"w2-agreement","stepId":"employee-agreement","label":"Agreement / Signature","description":"Review and sign required agreements.","position":{"x":80,"y":400},"day":1,"required":true,"settings":{}},{"id":"w2-review","stepId":"completion-milestone","label":"Final Review / Completion","description":"Review and submit the application.","position":{"x":80,"y":560},"day":1,"required":true,"settings":{}}],"edges":[{"id":"w2-e1","source":"w2-resume","target":"w2-docs"},{"id":"w2-e2","source":"w2-docs","target":"w2-agreement"},{"id":"w2-e3","source":"w2-agreement","target":"w2-review"}]}'
    ),
    (
      'Default 1099 Onboarding',
      'Editable 1099 starting point with resume, contractor documents, agreement, and review.',
      '1099 Onboarding',
      '{"nodes":[{"id":"1099-resume","stepId":"resume-basic-profile","label":"Upload Resume","description":"Upload resume and confirm contact information.","position":{"x":80,"y":80},"day":1,"required":true,"settings":{}},{"id":"1099-docs","stepId":"document-upload","label":"Contractor Documents","description":"Upload required independent-contractor documents.","position":{"x":80,"y":240},"day":1,"required":true,"settings":{}},{"id":"1099-agreement","stepId":"employee-agreement","label":"Contractor Agreement / Signature","description":"Review and sign required contractor agreements.","position":{"x":80,"y":400},"day":1,"required":true,"settings":{}},{"id":"1099-review","stepId":"completion-milestone","label":"Final Review / Completion","description":"Review and submit the application.","position":{"x":80,"y":560},"day":1,"required":true,"settings":{}}],"edges":[{"id":"1099-e1","source":"1099-resume","target":"1099-docs"},{"id":"1099-e2","source":"1099-docs","target":"1099-agreement"},{"id":"1099-e3","source":"1099-agreement","target":"1099-review"}]}'
    )
) AS v(name, description, flow_name, builder_draft)
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_templates t
  WHERE t.type = 'preset' AND lower(t.name) = lower(v.name)
);

-- Existing workflow tables previously allowed every staff role to mutate them.
-- Keep recruiter visibility while restricting configuration writes to tenant admins.
DROP POLICY IF EXISTS onboarding_libraries_staff ON public.onboarding_libraries;
CREATE POLICY onboarding_libraries_staff_read
  ON public.onboarding_libraries FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));
CREATE POLICY onboarding_libraries_admin_write
  ON public.onboarding_libraries FOR ALL TO authenticated
  USING (public.user_is_tenant_admin(tenant_id))
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS onboarding_flows_staff ON public.onboarding_flows;
CREATE POLICY onboarding_flows_staff_read
  ON public.onboarding_flows FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));
CREATE POLICY onboarding_flows_admin_write
  ON public.onboarding_flows FOR ALL TO authenticated
  USING (public.user_is_tenant_admin(tenant_id))
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS onboarding_flow_steps_staff ON public.onboarding_flow_steps;
CREATE POLICY onboarding_flow_steps_staff_read
  ON public.onboarding_flow_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_flows f
      WHERE f.id = onboarding_flow_steps.flow_id
        AND public.user_is_tenant_staff(f.tenant_id)
    )
  );
CREATE POLICY onboarding_flow_steps_admin_write
  ON public.onboarding_flow_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_flows f
      WHERE f.id = onboarding_flow_steps.flow_id
        AND public.user_is_tenant_admin(f.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_flows f
      WHERE f.id = onboarding_flow_steps.flow_id
        AND public.user_is_tenant_admin(f.tenant_id)
    )
  );

DROP POLICY IF EXISTS onboarding_templates_staff ON public.onboarding_templates;
CREATE POLICY onboarding_templates_staff_read
  ON public.onboarding_templates FOR SELECT TO authenticated
  USING (
    type = 'preset'
    OR (tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id))
  );
CREATE POLICY onboarding_templates_admin_write
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (
    type = 'saved'
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    type = 'saved'
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS onboarding_template_steps_staff ON public.onboarding_template_steps;
CREATE POLICY onboarding_template_steps_staff_read
  ON public.onboarding_template_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_templates t
      WHERE t.id = onboarding_template_steps.template_id
        AND (
          t.type = 'preset'
          OR (t.tenant_id IS NOT NULL AND public.user_is_tenant_staff(t.tenant_id))
        )
    )
  );
CREATE POLICY onboarding_template_steps_admin_write
  ON public.onboarding_template_steps FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_templates t
      WHERE t.id = onboarding_template_steps.template_id
        AND t.type = 'saved'
        AND t.tenant_id IS NOT NULL
        AND public.user_is_tenant_admin(t.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_templates t
      WHERE t.id = onboarding_template_steps.template_id
        AND t.type = 'saved'
        AND t.tenant_id IS NOT NULL
        AND public.user_is_tenant_admin(t.tenant_id)
    )
  );

DROP POLICY IF EXISTS workflow_templates_staff ON public.workflow_templates;
CREATE POLICY workflow_templates_staff_read
  ON public.workflow_templates FOR SELECT TO authenticated
  USING (
    is_preset = true
    OR (tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id))
  );
CREATE POLICY workflow_templates_admin_write
  ON public.workflow_templates FOR ALL TO authenticated
  USING (
    is_preset = false
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    is_preset = false
    AND tenant_id IS NOT NULL
    AND public.user_is_tenant_admin(tenant_id)
  );
