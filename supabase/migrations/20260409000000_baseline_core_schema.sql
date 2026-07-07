-- Baseline core schema for BrassHR multi-tenant.
-- Tables that existed before the first tracked migration (20260410130000)
-- but were never created in supabase/migrations.
--
-- Reconstructed from migrations, app insert/select payloads, and bundle SQL.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('worker', 'recruiter', 'support', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Legacy employment enum (text pipeline `status` is added in 20260410170000)
DO $$ BEGIN
  CREATE TYPE public.worker_status AS ENUM (
    'new',
    'active',
    'inactive',
    'cancelled',
    'banned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  role public.app_role NOT NULL DEFAULT 'worker',
  email_verified boolean NOT NULL DEFAULT false,
  god_admin boolean NOT NULL DEFAULT false,
  signup_completed_at timestamptz,
  tenant_onboarding_completed_at timestamptz,
  job_title text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);

COMMENT ON TABLE public.users IS
  'Staff/recruiter profiles keyed to auth.users. tenant_id nullable for platform owners.';
COMMENT ON COLUMN public.users.god_admin IS
  'Cross-tenant platform admin; omit tenant-bound rows or use impersonation helpers in app/API.';
COMMENT ON COLUMN public.users.signup_completed_at IS
  'Set when the Braas HR owner completes account signup (before tenant provisioning).';
COMMENT ON COLUMN public.users.tenant_onboarding_completed_at IS
  'Set when the owner finishes tenant onboarding and may access recruiter admin.';

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON public.users (tenant_id);

-- ---------------------------------------------------------------------------
-- public.worker  (singular — used everywhere)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  address1 text,
  address2 text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  job_role text,
  lat double precision,
  lng double precision,
  experience_years integer,
  worker_status public.worker_status DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_user_id_key UNIQUE (user_id)
);

COMMENT ON TABLE public.worker IS
  'Applicant/candidate profile rows (onboarding + recruiter pipeline).';

CREATE INDEX IF NOT EXISTS worker_tenant_id_idx ON public.worker (tenant_id);
CREATE INDEX IF NOT EXISTS worker_user_id_idx ON public.worker (user_id);
CREATE INDEX IF NOT EXISTS worker_email_idx ON public.worker (email);

-- ---------------------------------------------------------------------------
-- public.worker_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  worker_id uuid NOT NULL,
  ssn_url text,
  drivers_license_url text,
  document_url text,
  document_name text,
  document_id text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_documents_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES public.worker (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.worker_documents IS
  'Legacy per-worker document URL row (license/TB/CPR/SSN/DL/authorization).';

CREATE INDEX IF NOT EXISTS worker_documents_worker_id_idx
  ON public.worker_documents (worker_id);

-- ---------------------------------------------------------------------------
-- public.worker_requirements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  worker_id uuid NOT NULL,
  ssn_card_path text,
  drivers_license_path text,
  resume_path text,
  job_certificate_path text,
  drug_test_results_path text,
  w9_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_requirements_worker_id_fkey
    FOREIGN KEY (worker_id) REFERENCES public.worker (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.worker_requirements IS
  'Legacy per-worker storage paths for step-4 uploads (resume, SSN/DL, etc.).';

CREATE INDEX IF NOT EXISTS worker_requirements_worker_id_idx
  ON public.worker_requirements (worker_id);

-- ---------------------------------------------------------------------------
-- Helper functions referenced before later migrations define them
-- ---------------------------------------------------------------------------

-- Referenced by legacy tenant_isolation RLS (see 20260508210000 comment)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.worker_belongs_to_auth(p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker w
    WHERE w.id = p_worker_id
      AND w.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.worker_belongs_to_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_belongs_to_auth(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_own ON public.users;
CREATE POLICY users_read_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS worker_own_session ON public.worker;
CREATE POLICY worker_own_session
  ON public.worker
  FOR ALL
  TO PUBLIC
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS worker_documents_own ON public.worker_documents;
CREATE POLICY worker_documents_own
  ON public.worker_documents
  FOR ALL
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

DROP POLICY IF EXISTS worker_requirements_own ON public.worker_requirements;
CREATE POLICY worker_requirements_own
  ON public.worker_requirements
  FOR ALL
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id))
  WITH CHECK (public.worker_belongs_to_auth(worker_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker TO anon, authenticated;
GRANT ALL ON public.worker TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_documents TO authenticated;
GRANT ALL ON public.worker_documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_requirements TO authenticated;
GRANT ALL ON public.worker_requirements TO service_role;
