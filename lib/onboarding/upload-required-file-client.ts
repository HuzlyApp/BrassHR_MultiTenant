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
  if (!json.publicUrl) {
    throw new Error("Could not generate public URL");
  }

  return {
    publicUrl: json.publicUrl,
    path: json.path ?? "",
    fileName: json.fileName ?? file.name,
  };
}

export async function resolveApplicantId(): Promise<string> {
  if (typeof window === "undefined") return "";
  let applicantId = localStorage.getItem("applicantId")?.trim() || "";
  if (applicantId) return applicantId;

  const { supabaseBrowser } = await import("@/lib/supabase-browser");
  const { data } = await supabaseBrowser.auth.getUser();
  applicantId = data?.user?.id?.trim() || "";
  if (applicantId) {
    localStorage.setItem("applicantId", applicantId);
  }
  return applicantId;
}
