/** Client-safe file validation for support ticket uploads (no Node.js imports). */

export const MAX_SUPPORT_TICKET_FILE_BYTES = Number(
  process.env.NEXT_PUBLIC_MAX_SUPPORT_TICKET_FILE_BYTES ??
    process.env.MAX_SUPPORT_TICKET_FILE_BYTES ??
    10 * 1024 * 1024
);

export const ALLOWED_SUPPORT_TICKET_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "text/plain",
]);

export function sanitizeSupportTicketFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export function validateSupportTicketFile(file: File): string | null {
  if (file.size > MAX_SUPPORT_TICKET_FILE_BYTES) {
    return "File is too large (max 10 MB).";
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_SUPPORT_TICKET_MIME.has(mime)) {
    return "File type not allowed. Upload PDF, DOCX, PNG, JPG, JPEG, or TXT.";
  }
  return null;
}
