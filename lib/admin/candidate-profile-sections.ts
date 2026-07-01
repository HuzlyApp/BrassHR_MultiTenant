export type CandidateProfileSectionId = "education" | "experience" | "skills" | "facilities";

export const PROFILE_YEARS_EXPERIENCE_ANCHOR_ID = "profile-years-experience";

export const PROFILE_FIELD_OPEN_EDIT_EVENT = "profile-field-open-edit";

export function scrollToProfileField(anchorId: string, openEdit = false) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (openEdit) {
      window.dispatchEvent(
        new CustomEvent(PROFILE_FIELD_OPEN_EDIT_EVENT, { detail: { id: anchorId } })
      );
    }
  });
}

export function candidateProfileSectionHref(
  section: CandidateProfileSectionId,
  applicantId: string,
  isWorkerRoute = false
): string {
  const base = isWorkerRoute ? "/admin_recruiter/workers" : "/admin_recruiter/new";

  switch (section) {
    case "education":
      return isWorkerRoute
        ? `${base}/${applicantId}/profile/resume`
        : `${base}/profile/resume/${applicantId}`;
    case "experience":
      return isWorkerRoute
        ? `${base}/${applicantId}/profile#${PROFILE_YEARS_EXPERIENCE_ANCHOR_ID}`
        : `${base}/profile/${applicantId}#${PROFILE_YEARS_EXPERIENCE_ANCHOR_ID}`;
    case "skills":
      return isWorkerRoute
        ? `${base}/${applicantId}/skill-assessments`
        : `${base}/skill-assessments/${applicantId}`;
    case "facilities":
      return isWorkerRoute
        ? `${base}/${applicantId}/facility-assignments`
        : `${base}/facility-assignments/${applicantId}`;
  }
}

export type ProfileEducationLine = {
  label: string;
  value: string;
  href?: string;
};

export function buildProfileEducationLines(input: {
  profile_license?: {
    license_type?: string;
    license_type_label?: string;
    license_number?: string | null;
    expires_at?: string | null;
    status?: string | null;
  } | null;
  nursing_licenses?: Array<{
    license_type?: string | null;
    license_type_key?: string | null;
    state?: string | null;
    expires_at?: string | null;
  }>;
  requirements?: {
    resume_path?: string | null;
    resume_url?: string | null;
  } | null;
  education?: {
    resume_available?: boolean;
  };
  formatDate: (iso: string | null | undefined) => string;
}): ProfileEducationLine[] {
  const lines: ProfileEducationLine[] = [];
  const license = input.profile_license;

  if (license?.license_type_label?.trim() || license?.license_type?.trim()) {
    lines.push({
      label: "License",
      value: (license.license_type_label || license.license_type || "").trim(),
    });
  }

  if (license?.license_number?.trim()) {
    lines.push({ label: "License #", value: license.license_number.trim() });
  }

  if (license?.expires_at) {
    lines.push({ label: "Expires", value: input.formatDate(license.expires_at) });
  }

  const nursing = input.nursing_licenses?.[0];
  if (!lines.some((line) => line.label === "License") && nursing?.license_type?.trim()) {
    lines.push({ label: "License", value: nursing.license_type.trim() });
  }

  if (nursing?.state?.trim()) {
    lines.push({ label: "State", value: nursing.state.trim() });
  }

  const resumeUrl = input.requirements?.resume_url?.trim();
  if (resumeUrl) {
    lines.push({ label: "Resume", value: "View resume", href: resumeUrl });
  } else if (input.education?.resume_available || input.requirements?.resume_path?.trim()) {
    lines.push({ label: "Resume", value: "On file" });
  }

  return lines;
}
