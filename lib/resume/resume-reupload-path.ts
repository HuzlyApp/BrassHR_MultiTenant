/**
 * `worker_resumes` has no reupload column, so a reupload is recorded the same
 * way uploader role is: as a folder segment in the storage path. The first path
 * segment is left untouched so the bucket's owner-scoped RLS policies still hold.
 */
export const RESUME_REUPLOAD_FOLDER = "reuploads";

const REUPLOAD_SEGMENT = new RegExp(`(?:^|/)${RESUME_REUPLOAD_FOLDER}/`, "i");

export function resumeUploadFolder(baseFolder: string, isReupload: boolean): string {
  const folder = baseFolder.replace(/\/+$/, "");
  return isReupload ? `${folder}/${RESUME_REUPLOAD_FOLDER}` : folder;
}

export function isReuploadedResumePath(
  storagePath: string | null | undefined,
  fileUrl?: string | null
): boolean {
  const path = (storagePath ?? "").trim() || (fileUrl ?? "").trim();
  if (!path) return false;
  return REUPLOAD_SEGMENT.test(path);
}
