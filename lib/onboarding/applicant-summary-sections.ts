import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";
import {
  countCompleteReferencesFromStorage,
  MIN_COMPLETE_REFERENCES,
} from "@/lib/referencesValidation";
import type {
  OnboardingStepStatus,
  TenantOnboardingConfig,
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { withTenant } from "@/lib/tenant/with-tenant";
import {
  isSkillQuizDoneLocal,
  mergeAuthorizationSigningState,
  mergeStep2FileRecords,
  parseStep2Files,
  quizSlugForCategory,
  readAuthorizationSigningState,
  readResumeFileIndicators,
  step2FilesFromDocumentUrls,
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
    nursing_license_url?: string | null;
    tb_test_url?: string | null;
    cpr_certification_url?: string | null;
    ssn_url?: string | null;
    drivers_license_url?: string | null;
  } | null;
  identityLs: {
    ssn?: { name?: string; url?: string };
    license?: { name?: string; url?: string };
  } | null;
  authState: ReturnType<typeof readAuthorizationSigningState>;
  /** Tenant-config uploads keyed by required_document_id */
  submittedDocuments: Array<{
    required_document_id: string;
    original_file_name: string | null;
    status: string | null;
  }>;
  referencesCount: number;
};

function progressStatusForStep(
  config: TenantOnboardingConfig | null | undefined,
  progress: WorkerOnboardingProgressPayload | null | undefined,
  step: TenantOnboardingStep
): OnboardingStepStatus | null {
  if (!progress) return null;
  const row = progress.steps.find((r) => r.onboarding_step_id === step.id);
  return row?.status ?? "pending";
}

function isProgressStepComplete(status: OnboardingStepStatus | null): boolean {
  return status === "completed" || status === "skipped";
}

function resolvedStep2Files(snapshot: ApplicantSummarySnapshot): Record<Step2FileType, Step2UploadedFile | null> {
  const fromServer = step2FilesFromDocumentUrls(snapshot.workerDocs);
  return mergeStep2FileRecords(snapshot.step2Files, fromServer);
}

function referencesMinForStep(step: TenantOnboardingStep): number {
  const n = step.metadata?.min_count;
  return typeof n === "number" && n > 0 ? n : MIN_COMPLETE_REFERENCES;
}

function sectionForStep(
  step: TenantOnboardingStep,
  snapshot: ApplicantSummarySnapshot,
  tenantSlug: string | null,
  config: TenantOnboardingConfig | null | undefined,
  progress: WorkerOnboardingProgressPayload | null | undefined
): SummarySectionModel | null {
  const editHref = withTenant(routeForApplicantStep(step), tenantSlug);
  const progressComplete = isProgressStepComplete(progressStatusForStep(config, progress, step));

  switch (step.step_type) {
    case "resume_upload":
    case "profile_information": {
      const complete = progressComplete || snapshot.resumeInfo.hasUploadedFile;
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
      const step2Files = resolvedStep2Files(snapshot);
      const hasSubmittedDocs = snapshot.submittedDocuments.some(
        (d) => Boolean(d.original_file_name?.trim()) || d.status === "uploaded" || d.status === "approved"
      );
      const complete = progressComplete || step2HasAnyUpload(step2Files) || hasSubmittedDocs;
      const requirementRows = STEP2_FILE_TYPES.filter((k) =>
        Boolean(step2Files?.[k]?.name)
      ).map((k) => ({
        key: k,
        title: STEP2_REQUIREMENT_LABELS[k],
        subtitle:
          [step2Files![k]!.name, step2Files![k]!.size]
            .filter(Boolean)
            .join(" · ") || step2Files![k]!.name,
        complete: true,
      }));
      const submittedRows = snapshot.submittedDocuments
        .filter((d) => Boolean(d.original_file_name?.trim()))
        .map((d) => ({
          key: `submitted-${d.required_document_id}`,
          title: d.original_file_name!.trim(),
          subtitle: d.status ? `Status: ${d.status}` : "Uploaded",
          complete: true,
        }));
      const rows = [...requirementRows, ...submittedRows];
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref,
        rows:
          rows.length > 0
            ? rows
            : progressComplete
              ? [
                  {
                    key: "requirements",
                    title: step.title,
                    subtitle: "Completed",
                    complete: true,
                  },
                ]
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
        complete = progressComplete || (fb.total > 0 && fb.completed === fb.total);
        label = snapshot.skillLoadError
          ? `Could not load assessment list (${snapshot.skillLoadError}). Showing progress saved on this device.`
          : fb.total > 0
            ? `${fb.completed} of ${fb.total} assessments completed (saved on this device)`
            : "No skill assessments recorded yet";
      } else {
        const completed = slugs.filter((slug) => isSkillQuizDoneLocal(slug)).length;
        complete = progressComplete || completed === slugs.length;
        label = `${completed} of ${slugs.length} ${slugs.length === 1 ? "assessment" : "assessments"} completed`;
      }
      return {
        id: step.step_key,
        heading: step.title,
        complete,
        editHref: withTenant(APPLICATION_ROUTES.skillAssessment, tenantSlug),
        rows: [{ key: "skills", title: step.title, subtitle: label, complete }],
      };
    }
    case "authorizations": {
      const authState = snapshot.authState;
      const authSigned = progressComplete || authState.display === "signed";
      const hasSsn = Boolean(snapshot.workerDocs?.ssn_url?.trim() || snapshot.identityLs?.ssn?.name);
      const hasDl = Boolean(
        snapshot.workerDocs?.drivers_license_url?.trim() || snapshot.identityLs?.license?.name
      );
      const complete = progressComplete || (authSigned && hasSsn && hasDl);
      const rows: SummaryRowModel[] = [];
      if (progressComplete || authState.hasActivity) {
        rows.push({
          key: "auth",
          title: "Authorization agreement",
          subtitle: progressComplete || authState.display === "signed"
            ? authState.statusRaw && authState.display === "signed"
              ? `Signed (${authState.statusRaw})`
              : "Signed"
            : authState.statusRaw
              ? `Status: ${authState.statusRaw}`
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
      const complete = progressComplete || snapshot.referencesCount >= min;
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
        complete: progressComplete,
        editHref,
        rows: [
          {
            key: step.step_key,
            title: step.title,
            subtitle: progressComplete ? "Completed" : "Complete this step",
            complete: progressComplete,
          },
        ],
      };
  }
}

export function buildApplicantSummarySections(
  config: TenantOnboardingConfig | null | undefined,
  tenantSlug: string | null,
  snapshot: ApplicantSummarySnapshot,
  progress?: WorkerOnboardingProgressPayload | null
): SummarySectionModel[] {
  const enabled = getEnabledTenantSteps(config);
  const steps = enabled.length ? enabled : [];
  const sections: SummarySectionModel[] = [];

  for (const step of steps) {
    if (step.step_type === "review_submit") continue;
    const section = sectionForStep(step, snapshot, tenantSlug, config, progress ?? null);
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
    submittedDocuments: [],
    referencesCount: countCompleteReferencesFromStorage(),
  };
}
