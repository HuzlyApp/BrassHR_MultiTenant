-- Allow agreement W2 / I9 keys in legacy review table.

ALTER TABLE public.worker_legacy_document_reviews
  DROP CONSTRAINT IF EXISTS worker_legacy_document_reviews_key_chk;

ALTER TABLE public.worker_legacy_document_reviews
  ADD CONSTRAINT worker_legacy_document_reviews_key_chk CHECK (
    document_key IN (
      'nursing_license_url',
      'tb_test_url',
      'cpr_certification_url',
      'ssn_url',
      'ssn_back_url',
      'drivers_license_url',
      'drivers_license_back_url',
      'document_url',
      'agreement_w2_url',
      'agreement_i9_url'
    )
  );

