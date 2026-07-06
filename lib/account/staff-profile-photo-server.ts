import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_PROFILE_PHOTOS_BUCKET } from "@/lib/supabase-storage-buckets";
import {
  createSignedStaffProfilePhotoUrl,
  sanitizeStaffProfileFileName,
  validateStaffProfilePhoto,
} from "@/lib/account/staff-profile-photo";

export async function uploadStaffProfilePhoto(
  supabase: SupabaseClient,
  file: File,
  userId: string
): Promise<{ storagePath: string; signedUrl: string | null }> {
  const validationError = validateStaffProfilePhoto(file);
  if (validationError) throw new Error(validationError);

  const storagePath = `${userId}/profile-photo/${Date.now()}-${randomUUID()}-${sanitizeStaffProfileFileName(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(STAFF_PROFILE_PHOTOS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const signedUrl = await createSignedStaffProfilePhotoUrl(supabase, storagePath);
  return { storagePath, signedUrl };
}
