import { buildWorkerResumeFileName } from "@/lib/resume/worker-resume-file-name";

/**
 * Display name for a stored resume path. Prefer First_Last_resume.ext so the
 * Resume tab matches AI Analysis (not the UUID-prefixed storage leaf).
 */
export function resumeDisplayFileName(
  path: string | null | undefined,
  worker?: { first_name?: string | null; last_name?: string | null } | null
): string {
  const leaf = path?.trim() ? path.split("/").pop() || path.trim() : "";
  const extMatch = leaf.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = extMatch?.[1] ?? ".pdf";
  if (worker?.first_name || worker?.last_name) {
    return buildWorkerResumeFileName({
      firstName: worker.first_name,
      lastName: worker.last_name,
      originalFileName: leaf || `resume${ext}`,
    });
  }
  if (!leaf) return "resume.pdf";
  const withoutUuidPrefix = leaf.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[-_]?/i,
    ""
  );
  return withoutUuidPrefix || leaf;
}
