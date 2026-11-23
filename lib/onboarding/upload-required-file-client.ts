/** Client helper for POST /api/onboarding/upload-required-file */
export async function uploadRequiredOnboardingFile(
  file: File,
  folder: "license" | "tb" | "cpr" | "ssn" | "other",
  applicantId: string
): Promise<{ publicUrl: string; path: string; fileName: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  fd.append("applicantId", applicantId);

  const res = await fetch("/api/onboarding/upload-required-file", {
    method: "POST",
    body: fd,
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    publicUrl?: string;
    path?: string;
    fileName?: string;
  };

  if (!res.ok) {
    throw new Error(json.error || "File upload failed");
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

import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isOnboardingDraftPreview,
} from "@/lib/onboarding/is-draft-preview";
import { getScopedApplicantId, setScopedApplicantId } from "@/lib/tenant/scoped-storage";

export async function resolveApplicantId(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (isOnboardingDraftPreview(window.location.search)) {
    setScopedApplicantId(DRAFT_PREVIEW_APPLICANT_ID);
    return DRAFT_PREVIEW_APPLICANT_ID;
  }

  let applicantId = getScopedApplicantId() || "";
  if (applicantId) return applicantId;

  const { supabaseBrowser } = await import("@/lib/supabase-browser");
  const { data } = await supabaseBrowser.auth.getUser();
  applicantId = data?.user?.id?.trim() || "";
  if (applicantId) {
    setScopedApplicantId(applicantId);
  }
  return applicantId;
}
