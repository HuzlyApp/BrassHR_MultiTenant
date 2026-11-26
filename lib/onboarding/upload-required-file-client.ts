import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isOnboardingDraftPreview,
} from "@/lib/onboarding/is-draft-preview";
import { setScopedApplicantId } from "@/lib/tenant/scoped-storage";

export function formatOnboardingAccessError(
  json: { error?: string; reason?: string; detail?: string },
  status: number,
  fallback: string
): string {
  const base = json.error?.trim() || fallback;
  if (status === 401) {
    return "Your application session expired. Refresh the page and try again.";
  }
  if (status === 403) {
    if (json.reason === "origin_mismatch") {
      return "Upload blocked by browser security. Open the application from the same site and try again.";
    }
    if (json.reason === "application_ownership" || json.reason === "applicant_mismatch") {
      return "This application belongs to a different browser session. Sign in with the email used on your application, then try again.";
    }
    if (base && base !== "Forbidden") return base;
    return "Upload was blocked (session mismatch). Refresh the page and try again.";
  }
  return base;
}

/**
 * Resolve the applicant auth user id and ensure the HTTP-only access cookie is fresh.
 * Always goes through the isolated applicant auth client — never the staff supabaseBrowser.
 */
export async function resolveApplicantId(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (isOnboardingDraftPreview(window.location.search)) {
    setScopedApplicantId(DRAFT_PREVIEW_APPLICANT_ID);
    return DRAFT_PREVIEW_APPLICANT_ID;
  }

  const { ensureApplicantMatchesAuthSession } = await import(
    "@/lib/onboarding/ensure-applicant-auth"
  );
  const result = await ensureApplicantMatchesAuthSession();
  if ("error" in result) {
    console.warn("[onboarding] resolveApplicantId session refresh failed", result.error);
    return "";
  }
  return result.applicantId;
}

/** Client helper for POST /api/onboarding/upload-required-file */
export async function uploadRequiredOnboardingFile(
  file: File,
  folder: "license" | "tb" | "cpr" | "ssn" | "other",
  applicantId: string
): Promise<{ publicUrl: string; path: string; fileName: string }> {
  // Refresh the HTTP-only applicant cookie before the upload so authorizeOnboardingRequest
  // does not 403 when localStorage still has applicantId but brass_applicant_access expired.
  const refreshedId = await resolveApplicantId();
  const effectiveId = refreshedId || applicantId;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  fd.append("applicantId", effectiveId);

  const res = await fetch("/api/onboarding/upload-required-file", {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    reason?: string;
    publicUrl?: string;
    path?: string;
    fileName?: string;
  };

  if (!res.ok) {
    throw new Error(formatOnboardingAccessError(json, res.status, "File upload failed"));
  }
  const storedPath = json.path?.trim() || "";
  const publicUrl = json.publicUrl?.trim() || storedPath;
  if (!publicUrl && !storedPath) {
    throw new Error("Could not save uploaded file");
  }

  return {
    publicUrl,
    path: storedPath,
    fileName: json.fileName ?? file.name,
  };
}
