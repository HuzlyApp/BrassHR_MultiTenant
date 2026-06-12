-- Document review status for legacy worker_documents columns (SSN, license, authorization, etc.)
-- Dynamic onboarding docs continue to use worker_submitted_documents.status.

ALTER TABLE public.worker_submitted_documents
  DROP CONSTRAINT IF EXISTS worker_submitted_documents_status_chk;

ALTER TABLE public.worker_submitted_documents
  ADD CONSTRAINT worker_submitted_documents_status_chk CHECK (
    status IN ('uploaded', 'under_review', 'approved', 'rejected', 'needs_revision')
  );

ALTER TABLE public.worker_submitted_documents
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE TABLE IF NOT EXISTS public.worker_legacy_document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  document_key text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT worker_legacy_document_reviews_status_chk CHECK (
    status IN ('uploaded', 'under_review', 'approved', 'rejected', 'needs_revision')
  ),
  CONSTRAINT worker_legacy_document_reviews_key_chk CHECK (
    document_key IN (
      'nursing_license_url',
      'tb_test_url',
      'cpr_certification_url',
      'ssn_url',
      'ssn_back_url',
      'drivers_license_url',
      'drivers_license_back_url',
      'document_url'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_legacy_document_reviews_worker_key_uidx
  ON public.worker_legacy_document_reviews (worker_id, document_key);

CREATE OR REPLACE FUNCTION public.set_worker_legacy_document_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_legacy_document_reviews_updated_at ON public.worker_legacy_document_reviews;
CREATE TRIGGER trg_worker_legacy_document_reviews_updated_at
BEFORE UPDATE ON public.worker_legacy_document_reviews
FOR EACH ROW
EXECUTE FUNCTION public.set_worker_legacy_document_reviews_updated_at();

ALTER TABLE public.worker_legacy_document_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_legacy_document_reviews TO authenticated;
GRANT ALL ON public.worker_legacy_document_reviews TO service_role;

DROP POLICY IF EXISTS worker_legacy_document_reviews_staff ON public.worker_legacy_document_reviews;
CREATE POLICY worker_legacy_document_reviews_staff
  ON public.worker_legacy_document_reviews FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));
