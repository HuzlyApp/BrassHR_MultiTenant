/** Display / stored resume names: FirstName_LastName_resume.pdf */

const UNSAFE_FILE_CHARS = /[/\\?%*:|"<>]/g;

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function resumeFileExtension(originalFileName: string | null | undefined): string {
  const name = (originalFileName ?? "").trim();
  const match = name.match(/(\.[A-Za-z0-9]{1,8})$/);
  return match ? match[1].toLowerCase() : ".pdf";
}

export function sanitizeResumeNamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function fallbackResumeFileName(
  originalFileName: string | null | undefined,
  ext: string
): string {
  const trimmed = (originalFileName ?? "").trim();
  if (!trimmed) return `resume${ext}`;
  const base = trimmed
    .replace(/^.*[/\\]/, "")
    .replace(UNSAFE_FILE_CHARS, "_")
    .slice(0, 200)
    .trim();
  return base || `resume${ext}`;
}

/**
 * Canonical resume filename: `Joe_Bloe_resume.pdf`.
 * Falls back to the original upload name when first/last are missing.
 */
export function buildWorkerResumeFileName(input: {
  firstName?: string | null;
  lastName?: string | null;
  originalFileName?: string | null;
}): string {
  const ext = resumeFileExtension(input.originalFileName);
  const first = sanitizeResumeNamePart(input.firstName ?? "");
  const last = sanitizeResumeNamePart(input.lastName ?? "");
  const base = [first, last].filter(Boolean).join("_");
  if (base) return `${base}_resume${ext}`;
  return fallbackResumeFileName(input.originalFileName, ext);
}

export function contentDispositionInline(fileName: string): string {
  const safe = fileName.replace(/["\\\r\n]/g, "_");
  return `inline; filename="${safe}"`;
}
