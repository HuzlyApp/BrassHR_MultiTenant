-- Applicant portal: license records, portal documents, and applicant RLS

CREATE TABLE IF NOT EXISTS public.worker_license_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  license_type text NOT NULL,
  license_number text,
  expires_at date,
  file_url text,
  storage_path text,
  original_file_name text,
  file_type text,
  file_size bigint,
  status text NOT NULL DEFAULT 'under_review',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_license_records_type_chk CHECK (
    license_type IN ('nursing_license', 'drivers_license', 'cpr_certification', 'tb_test', 'other')
  ),
  CONSTRAINT worker_license_records_status_chk CHECK (
    status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_revision', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS worker_license_records_worker_expires_idx
  ON public.worker_license_records (worker_id, expires_at);

CREATE INDEX IF NOT EXISTS worker_license_records_tenant_status_idx
  ON public.worker_license_records (tenant_id, status);

CREATE TABLE IF NOT EXISTS public.worker_portal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  storage_path text NOT NULL,
  original_file_name text,
  file_type text,
  file_size bigint,
  status text NOT NULL DEFAULT 'under_review',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_portal_documents_status_chk CHECK (
    status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_revision')
  )
);

CREATE INDEX IF NOT EXISTS worker_portal_documents_worker_uploaded_idx
  ON public.worker_portal_documents (worker_id, uploaded_at DESC);

CREATE OR REPLACE FUNCTION public.set_worker_license_records_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_license_records_updated_at ON public.worker_license_records;
CREATE TRIGGER trg_worker_license_records_updated_at
BEFORE UPDATE ON public.worker_license_records
FOR EACH ROW EXECUTE FUNCTION public.set_worker_license_records_updated_at();

CREATE OR REPLACE FUNCTION public.set_worker_portal_documents_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_portal_documents_updated_at ON public.worker_portal_documents;
CREATE TRIGGER trg_worker_portal_documents_updated_at
BEFORE UPDATE ON public.worker_portal_documents
FOR EACH ROW EXECUTE FUNCTION public.set_worker_portal_documents_updated_at();

ALTER TABLE public.worker_license_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_portal_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.worker_license_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.worker_portal_documents TO authenticated;
GRANT ALL ON public.worker_license_records TO service_role;
GRANT ALL ON public.worker_portal_documents TO service_role;

DROP POLICY IF EXISTS worker_license_records_applicant ON public.worker_license_records;
CREATE POLICY worker_license_records_applicant
  ON public.worker_license_records
  FOR ALL
  TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id))
  WITH CHECK (public.approved_applicant_owns_worker(worker_id));

DROP POLICY IF EXISTS worker_license_records_staff ON public.worker_license_records;
CREATE POLICY worker_license_records_staff
  ON public.worker_license_records
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_portal_documents_applicant ON public.worker_portal_documents;
CREATE POLICY worker_portal_documents_applicant
  ON public.worker_portal_documents
  FOR ALL
  TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id))
  WITH CHECK (public.approved_applicant_owns_worker(worker_id));

DROP POLICY IF EXISTS worker_portal_documents_staff ON public.worker_portal_documents;
CREATE POLICY worker_portal_documents_staff
  ON public.worker_portal_documents
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_documents_applicant_select ON public.worker_documents;
CREATE POLICY worker_documents_applicant_select
  ON public.worker_documents
  FOR SELECT
  TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id));

DROP POLICY IF EXISTS worker_legacy_document_reviews_applicant ON public.worker_legacy_document_reviews;
CREATE POLICY worker_legacy_document_reviews_applicant
  ON public.worker_legacy_document_reviews
  FOR ALL
  TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id))
  WITH CHECK (public.approved_applicant_owns_worker(worker_id));

COMMENT ON TABLE public.worker_license_records IS 'Applicant/worker license records with expiration and admin review status.';
COMMENT ON TABLE public.worker_portal_documents IS 'Additional applicant-uploaded documents outside required onboarding config.';
