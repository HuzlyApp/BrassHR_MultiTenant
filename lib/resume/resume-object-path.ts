const SAFE_RESUME_PATH = /^[A-Za-z0-9][A-Za-z0-9/_.()\-]{0,500}$/;

/**
 * Storage object name segment only — must stay compatible with {@link assertResumeObjectPath}.
 * Display names (DB / UI) can keep spaces; storage paths cannot.
 */
export function sanitizeResumeStorageFileName(name: string, maxLen = 200): string {
  const leaf = name.trim().replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  let cleaned = leaf
    .replace(/[^A-Za-z0-9._()\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(1, maxLen));

  if (!cleaned || !/^[A-Za-z0-9]/.test(cleaned)) {
    cleaned = `resume_${cleaned || "file"}`.replace(/[^A-Za-z0-9._()\-]+/g, "_").slice(0, Math.max(1, maxLen));
  }
  if (!cleaned || !/^[A-Za-z0-9]/.test(cleaned)) {
    return "resume.pdf";
  }
  return cleaned;
}

/**
 * Storage paths are chosen by the server. A finalize call may only confirm a path
 * under the applicant or worker folder that this request is allowed to write.
 */
export function assertResumeObjectPath(path: string, allowedPrefixes: string[]): string {
  const normalized = path.trim().replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith("/") ||
    normalized.includes("//") ||
    !SAFE_RESUME_PATH.test(normalized)
  ) {
    throw new Error("Invalid resume path.");
  }
  const prefixes = allowedPrefixes.map((prefix) => prefix.replace(/\/+$/, "")).filter(Boolean);
  const allowed = prefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
  if (!allowed) throw new Error("Invalid resume path.");
  return normalized;
}
