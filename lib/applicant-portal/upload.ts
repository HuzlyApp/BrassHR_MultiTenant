import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_REQUIRED_FILE_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
]);

export function sanitizePortalFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export function validatePortalUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File is too large (max 10 MB).";
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_UPLOAD_MIME.has(mime)) {
    return "File type not allowed. Upload PDF or image files.";
  }
  return null;
}

export async function uploadApplicantPortalFile(
  supabase: SupabaseClient,
  file: File,
  workerId: string,
  folder: string
): Promise<{ storagePath: string; publicUrl: string }> {
  const validationError = validatePortalUploadFile(file);
  if (validationError) throw new Error(validationError);

  const storagePath = `portal/${workerId}/${folder}/${Date.now()}-${randomUUID()}-${sanitizePortalFileName(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(WORKER_REQUIRED_FILES_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: urlData.publicUrl };
}

export async function createSignedPortalFileUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(WORKER_REQUIRED_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
