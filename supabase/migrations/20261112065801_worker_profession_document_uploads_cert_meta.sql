-- Optional certificate/license metadata on profession document uploads.
-- Issuing organization, scope, and validity are never required.
-- Issued/expiry dates remain optional at the DB layer; app requires them only when "Has expiry date" is checked.

ALTER TABLE public.worker_profession_document_uploads
  ADD COLUMN IF NOT EXISTS issuing_organization text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS validity text;

COMMENT ON COLUMN public.worker_profession_document_uploads.issuing_organization IS
  'Optional issuing organization for certificates/licenses.';
COMMENT ON COLUMN public.worker_profession_document_uploads.scope IS
  'Optional credential scope.';
COMMENT ON COLUMN public.worker_profession_document_uploads.validity IS
  'Optional validity period text (e.g. 3 Years).';
