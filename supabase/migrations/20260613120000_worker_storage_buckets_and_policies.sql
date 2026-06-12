-- Worker document storage buckets + RLS policies.
-- Required by admin recruiter uploads and applicant onboarding.
-- See lib/supabase-storage-buckets.ts

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'worker-resumes',
    'worker-resumes',
    false,
    10485760,
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
  ),
  (
    'worker_required_files',
    'worker_required_files',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']::text[]
  ),
  (
    'worker-onboarding',
    'worker-onboarding',
    false,
    10485760,
    NULL
  ),
  (
    'docs',
    'docs',
    false,
    10485760,
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

-- ---------------------------------------------------------------------------
-- storage.objects policies — tenant staff may read/write their tenant folder
-- Path layouts:
--   worker_required_files/{tenant_id}/{worker_id}/...
--   worker_required_files/{folder}/{user_id}/...  (legacy applicant uploads)
-- Service role bypasses RLS for admin API signed URLs.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "worker_required_files_staff_select" ON storage.objects;
CREATE POLICY "worker_required_files_staff_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'worker_required_files'
  AND (
    public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "worker_required_files_staff_insert" ON storage.objects;
CREATE POLICY "worker_required_files_staff_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'worker_required_files'
  AND (
    public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "worker_required_files_staff_update" ON storage.objects;
CREATE POLICY "worker_required_files_staff_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'worker_required_files'
  AND (
    public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'worker_required_files'
  AND (
    public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "worker_resumes_owner_select" ON storage.objects;
CREATE POLICY "worker_resumes_owner_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'worker-resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "worker_resumes_owner_insert" ON storage.objects;
CREATE POLICY "worker_resumes_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'worker-resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "worker_resumes_owner_update" ON storage.objects;
CREATE POLICY "worker_resumes_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'worker-resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'worker-resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
