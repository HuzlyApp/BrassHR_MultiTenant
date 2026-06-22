import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_TICKET_FILES_BUCKET } from "@/lib/supabase-storage-buckets";
import {
  sanitizeSupportTicketFileName,
  validateSupportTicketFile,
} from "@/lib/support-tickets/support-ticket-file-validation";

export async function uploadSupportTicketFile(
  supabase: SupabaseClient,
  file: File,
  params: { tenantId: string; ticketId: string; uploadedBy: string }
): Promise<{ filePath: string; fileName: string; fileType: string | null; fileSize: number }> {
  const validationError = validateSupportTicketFile(file);
  if (validationError) throw new Error(validationError);

  const safeName = sanitizeSupportTicketFileName(file.name || "attachment");
  const filePath = `${params.tenantId}/${params.ticketId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = (file.type || "").toLowerCase() || null;

  const { error: uploadError } = await supabase.storage
    .from(SUPPORT_TICKET_FILES_BUCKET)
    .upload(filePath, bytes, {
      contentType: mime || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  return {
    filePath,
    fileName: safeName,
    fileType: mime,
    fileSize: file.size,
  };
}
