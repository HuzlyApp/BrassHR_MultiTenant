import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";
import {
  countCompleteReferencesFromStorage,
  MIN_COMPLETE_REFERENCES,
} from "@/lib/referencesValidation";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { withTenant } from "@/lib/tenant/with-tenant";
import {
  isSkillQuizDoneLocal,
  parseStep2Files,
  quizSlugForCategory,
  readAuthorizationSigningState,
  readResumeFileIndicators,
  step2HasAnyUpload,
  STEP2_FILE_TYPES,
  STEP2_REQUIREMENT_LABELS,
  countLocalLegacyQuizDone,
  type SkillCategoryRow,
  type Step2FileType,
  type Step2UploadedFile,
} from "@/lib/onboardingSummaryData";

export type SummaryRowModel = {
  key: string;
  title: string;
  subtitle: string | null;
  complete: boolean;
};

export type SummarySectionModel = {
  id: string;
  heading: string;
  complete: boolean;
  editHref: string;
  rows: SummaryRowModel[];
};

export type ApplicantSummarySnapshot = {
  resumeInfo: { fileName: string | null; hasUploadedFile: boolean };
  step2Files: Record<Step2FileType, Step2UploadedFile | null> | null;
  skillCategories: SkillCategoryRow[];
  skillLoadError: string | null;
  clientStorageReady: boolean;
  workerDocs: {
    ssn_url?: string | null;
    drivers_license_url?: string | null;
  } | null;
  identityLs: {
    ssn?: { name?: string; url?: string };
    license?: { name?: string; url?: string };
  } | null;
  authState: ReturnType<typeof readAuthorizationSigningState>;
  referencesCount: number;
};

function referencesMinForStep(step: TenantOnboardingStep): number {
  const n = step.metadata?.min_count;
  return typeof n === "number" && n > 0 ? n : MIN_COMPLETE_REFERENCES;
}

function sectionForStep(
  step: TenantOnboardingStep,
  snapshot: ApplicantSummarySnapshot,
  tenantSlug: string | null
): SummarySectionModel | null {
  const editHref = withTenant(
    routeForOnboardingStep(step.step_key, step.step_type),
    tenantSlug
  );

  switch (step.step_type) {
    case "resume_upload":
    case "profile_information": {
      const complete = snapshot.resumeInfo.hasUploadedFile;
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref,
        rows: [
          {
            key: "resume",
            title: "Resume file",
            subtitle: complete
              ? snapshot.resumeInfo.fileName || "File on file"
              : "No resume file uploaded yet",
            complete,
          },
        ],
      };
    }
    case "professional_license":
    case "document_upload": {
      const complete = step2HasAnyUpload(snapshot.step2Files);
      const requirementRows = STEP2_FILE_TYPES.filter((k) =>
        Boolean(snapshot.step2Files?.[k]?.name)
      ).map((k) => ({
        key: k,
        title: STEP2_REQUIREMENT_LABELS[k],
        subtitle:
          [snapshot.step2Files![k]!.name, snapshot.step2Files![k]!.size]
            .filter(Boolean)
            .join(" · ") || snapshot.step2Files![k]!.name,
        complete: true,
      }));
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref,
        rows:
          requirementRows.length > 0
            ? requirementRows
            : [
                {
                  key: "requirements",
                  title: step.title,
                  subtitle: "No documents uploaded yet",
                  complete: false,
                },
              ],
      };
    }
    case "skill_assessment": {
      const slugs = snapshot.skillCategories
        .map((c) => quizSlugForCategory(c))
        .filter((s): s is string => Boolean(s));
      let label: string;
      let complete: boolean;
      if (slugs.length === 0) {
        const fb = snapshot.clientStorageReady
          ? countLocalLegacyQuizDone()
          : { completed: 0, total: 0 };
        complete = fb.total > 0 && fb.completed === fb.total;
        label = snapshot.skillLoadError
          ? `Could not load assessment list (${snapshot.skillLoadError}). Showing progress saved on this device.`
          : fb.total > 0
            ? `${fb.completed} of ${fb.total} assessments completed (saved on this device)`
            : "No skill assessments recorded yet";
      } else {
        const completed = slugs.filter((slug) => isSkillQuizDoneLocal(slug)).length;
        complete = completed === slugs.length;
        label = `${completed} of ${slugs.length} ${slugs.length === 1 ? "assessment" : "assessments"} completed`;
      }
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref: withTenant("/application/step-3-assessment", tenantSlug),
        rows: [{ key: "skills", title: step.title, subtitle: label, complete }],
      };
    }
    case "authorizations": {
      const authSigned = snapshot.authState.display === "signed";
      const hasSsn = Boolean(snapshot.workerDocs?.ssn_url?.trim() || snapshot.identityLs?.ssn?.name);
      const hasDl = Boolean(
        snapshot.workerDocs?.drivers_license_url?.trim() || snapshot.identityLs?.license?.name
      );
      const complete = authSigned && hasSsn && hasDl;
      const rows: SummaryRowModel[] = [];
      if (snapshot.authState.hasActivity) {
        rows.push({
          key: "auth",
          title: "Authorization agreement",
          subtitle:
            snapshot.authState.display === "signed"
              ? snapshot.authState.statusRaw
                ? `Signed (${snapshot.authState.statusRaw})`
                : "Signed"
              : snapshot.authState.statusRaw
                ? `Status: ${snapshot.authState.statusRaw}`
                : "Pending signature",
          complete: authSigned,
        });
      }
      if (hasSsn) {
        rows.push({ key: "ssn", title: "SSN card", subtitle: "Uploaded", complete: true });
      }
      if (hasDl) {
        rows.push({ key: "dl", title: "Driver's license", subtitle: "Uploaded", complete: true });
      }
      if (rows.length === 0) {
        rows.push({
          key: "auth-empty",
          title: step.title,
          subtitle: "No signed authorization or identity documents recorded yet",
          complete: false,
        });
      }
      return { id: step.step_key, heading: step.title, complete, editHref, rows };
    }
    case "references": {
      const min = referencesMinForStep(step);
      const complete = snapshot.referencesCount >= min;
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref,
        rows: [
          {
            key: "refs",
            title: `${snapshot.referencesCount} reference(s) added`,
            subtitle: complete
              ? null
              : `At least ${min} complete reference${min === 1 ? "" : "s"} required`,
            complete,
          },
        ],
      };
    }
    case "review_submit":
      return null;
    default:
      return {
        id: step.step_key,
        heading: step.title,
        complete: false,
        editHref,
        rows: [{ key: step.step_key, title: step.title, subtitle: "Complete this step", complete: false }],
      };
  }
}

export function buildApplicantSummarySections(
  config: TenantOnboardingConfig | null | undefined,
  tenantSlug: string | null,
  snapshot: ApplicantSummarySnapshot
): SummarySectionModel[] {
  const enabled = getEnabledTenantSteps(config);
  const steps = enabled.length ? enabled : [];
  const sections: SummarySectionModel[] = [];

  for (const step of steps) {
    if (step.step_type === "review_submit") continue;
    const section = sectionForStep(step, snapshot, tenantSlug);
    if (section) sections.push(section);
  }

  return sections;
}

export function evaluateApplicantSummaryReadiness(
  config: TenantOnboardingConfig | null | undefined,
  sections: SummarySectionModel[]
): { allReady: boolean; incomplete: { id: string; title: string; href: string }[] } {
  const enabled = getEnabledTenantSteps(config);
  const requiredKeys = new Set(
    enabled.filter((s) => s.is_required && s.step_type !== "review_submit").map((s) => s.step_key)
  );

  const incomplete = sections
    .filter((s) => requiredKeys.has(s.id) && !s.complete)
    .map((s) => ({ id: s.id, title: s.heading, href: s.editHref }));

  const allReady = incomplete.length === 0;
  return { allReady, incomplete };
}

/** Default snapshot helpers for summary page mount. */
export function createApplicantSummarySnapshot(): ApplicantSummarySnapshot {
  return {
    resumeInfo: readResumeFileIndicators(),
    step2Files: parseStep2Files(),
    skillCategories: [],
    skillLoadError: null,
    clientStorageReady: false,
    workerDocs: null,
    identityLs: null,
    authState: readAuthorizationSigningState(),
    referencesCount: countCompleteReferencesFromStorage(),
  };
}
