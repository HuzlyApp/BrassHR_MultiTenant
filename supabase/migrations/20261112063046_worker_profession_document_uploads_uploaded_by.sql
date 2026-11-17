-- Track who uploaded each profession license/certificate file so admin uploads
-- show "Name (Admin/Recruiter)" instead of defaulting to the applicant.

ALTER TABLE public.worker_profession_document_uploads
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker_profession_document_uploads.uploaded_by_user_id IS
  'Auth user who uploaded the file (staff or applicant). Null for legacy rows.';

CREATE INDEX IF NOT EXISTS worker_profession_document_uploads_uploaded_by_idx
  ON public.worker_profession_document_uploads (uploaded_by_user_id)
  WHERE uploaded_by_user_id IS NOT NULL;

-- Staff profession uploads are stored under <tenant>/<worker>/admin/<staff user id>/...
UPDATE public.worker_profession_document_uploads u
SET uploaded_by_user_id = s.id
FROM auth.users s
WHERE u.uploaded_by_user_id IS NULL
  AND s.id::text = substring(
    u.file_url
    FROM '/admin/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
  );
