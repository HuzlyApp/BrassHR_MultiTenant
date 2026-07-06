-- Staff / admin recruiter profile photo (storage path in staff-profile-photos bucket)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_photo text;

COMMENT ON COLUMN public.users.profile_photo IS
  'Storage path or public URL for the staff user profile photo shown in admin recruiter UI.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-profile-photos',
  'staff-profile-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

-- Path layout: {user_id}/profile-photo/{filename}

DROP POLICY IF EXISTS staff_profile_photos_owner_select ON storage.objects;
CREATE POLICY staff_profile_photos_owner_select
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'staff-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS staff_profile_photos_owner_insert ON storage.objects;
CREATE POLICY staff_profile_photos_owner_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'staff-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS staff_profile_photos_owner_update ON storage.objects;
CREATE POLICY staff_profile_photos_owner_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'staff-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'staff-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS staff_profile_photos_owner_delete ON storage.objects;
CREATE POLICY staff_profile_photos_owner_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'staff-profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
