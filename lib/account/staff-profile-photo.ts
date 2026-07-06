import type { SupabaseClient } from "@supabase/supabase-js";
import { STAFF_PROFILE_PHOTOS_BUCKET } from "@/lib/supabase-storage-buckets";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/jpg", "image/webp"]);
const SIGNED_URL_TTL_SECONDS = 86_400;

export function sanitizeStaffProfileFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export function validateStaffProfilePhoto(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "Photo is too large (max 5 MB).";
  const mime = (file.type || "").toLowerCase();
  if (mime && !PROFILE_PHOTO_MIME.has(mime)) {
    return "Please upload a JPG or PNG photo.";
  }
  return null;
}

export async function createSignedStaffProfilePhotoUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.storage
    .from(STAFF_PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(trimmed, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveStaffProfilePhotoUrl(
  supabase: SupabaseClient,
  profilePhoto: unknown
): Promise<string | null> {
  const stored = typeof profilePhoto === "string" ? profilePhoto.trim() : "";
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  return createSignedStaffProfilePhotoUrl(supabase, stored);
}
