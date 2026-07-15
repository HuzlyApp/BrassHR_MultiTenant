import { describe, expect, it } from "vitest";
import { createDefaultOnboardingStepDrafts } from "@/lib/onboarding/default-onboarding-steps";
import {
  buildApplicantSummarySections,
  evaluateApplicantSummaryReadiness,
  type ApplicantSummarySnapshot,
} from "@/lib/onboarding/applicant-summary-sections";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

function buildConfig(): TenantOnboardingConfig {
  const drafts = createDefaultOnboardingStepDrafts();
  return {
    configId: "cfg-summary",
    tenantId: "tenant-1",
    version: 1,
    steps: drafts.map((d) => ({
      id: `step-${d.step_key}`,
      step_key: d.step_key,
      title: d.title,
      description: d.description,
      step_type: d.step_type,
      sort_order: d.sort_order,
      is_required: d.is_required,
      is_enabled: d.is_enabled,
      metadata: d.metadata,
    })),
    requiredDocuments: [],
    skillAssessments: [],
  };
}

import type { WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

function snapshot(partial: Partial<ApplicantSummarySnapshot>): ApplicantSummarySnapshot {
  return {
    resumeInfo: { fileName: "resume.pdf", hasUploadedFile: true },
    step2Files: null,
    skillCategories: [],
    skillLoadError: null,
    clientStorageReady: true,
    workerDocs: null,
    identityLs: null,
    authState: { statusRaw: "sent", display: "pending", hasActivity: true },
    submittedDocuments: [],
    referencesCount: 0,
    ...partial,
  };
}

describe("application summary submit readiness", () => {
  it("keeps accurate completion count when sections are incomplete", () => {
    const config = buildConfig();
    const sections = buildApplicantSummarySections(config, "zipstaff", snapshot({}));
    const completed = sections.filter((s) => s.complete).length;
    expect(completed).toBeLessThan(sections.length);
    expect(`${completed} of ${sections.length} sections complete`).toMatch(/\d+ of \d+ sections complete/);
  });

  it("lists incomplete required sections without marking them complete", () => {
    const config = buildConfig();
    const sections = buildApplicantSummarySections(config, "zipstaff", snapshot({}));
    const { incomplete, allReady } = evaluateApplicantSummaryReadiness(config, sections);
    expect(allReady).toBe(false);
    expect(incomplete.length).toBeGreaterThan(0);
    expect(sections.some((s) => !s.complete)).toBe(true);
  });

  it("marks sections complete from server step progress even when localStorage is stale", () => {
    const config = buildConfig();
    const licenseStep = config.steps.find((s) => s.step_type === "professional_license")!;
    const authStep = config.steps.find((s) => s.step_key === "authorization_background_check")!;
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: licenseStep.id, status: "completed", completed_at: "2026-01-01", data: {} },
        { onboarding_step_id: authStep.id, status: "completed", completed_at: "2026-01-01", data: {} },
      ],
    };
    const sections = buildApplicantSummarySections(
      config,
      "zipstaff",
      snapshot({
        step2Files: null,
        authState: { statusRaw: "signed", display: "signed", hasActivity: true },
      }),
      progress
    );
    const license = sections.find((s) => s.id === licenseStep.step_key);
    const auth = sections.find((s) => s.id === authStep.step_key);
    expect(license?.complete).toBe(true);
    expect(auth?.complete).toBe(true);
    expect(auth?.rows[0]?.subtitle).toMatch(/Signed/i);
    expect(auth?.rows[0]?.complete).toBe(true);
  });

  it("shows pending authorization on summary when step was skipped without signing", () => {
    const config = buildConfig();
    const authStep = config.steps.find((s) => s.step_key === "authorization_background_check")!;
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: authStep.id, status: "skipped", completed_at: "2026-01-01", data: {} },
      ],
    };
    const sections = buildApplicantSummarySections(
      config,
      "zipstaff",
      snapshot({
        authState: { statusRaw: "", display: "pending", hasActivity: true },
        workerDocs: {
          ssn_url: "tenant/worker/ssn.pdf",
          drivers_license_url: "tenant/worker/dl.pdf",
        },
      }),
      progress
    );
    const auth = sections.find((s) => s.id === authStep.step_key);
    const authRow = auth?.rows.find((r) => r.key === "auth");
    expect(authRow?.subtitle).toBe("Pending signature");
    expect(authRow?.complete).toBe(false);
  });

  it("shows skipped and incomplete sections distinctly on summary", () => {
    const config = buildConfig();
    config.steps = config.steps.map((step) =>
      step.step_key === "skill_assessment" ? { ...step, is_required: false } : step
    );
    const skillStep = config.steps.find((s) => s.step_type === "skill_assessment")!;
    const licenseStep = config.steps.find((s) => s.step_type === "professional_license")!;
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: skillStep.id, status: "skipped", completed_at: null, data: {} },
      ],
    };
    const sections = buildApplicantSummarySections(
      config,
      "zipstaff",
      snapshot({ step2Files: null }),
      progress
    );
    const skill = sections.find((s) => s.id === skillStep.step_key);
    const license = sections.find((s) => s.id === licenseStep.step_key);
    expect(skill?.stepStatus).toBe("skipped");
    expect(skill?.rows[0]?.subtitle).toBe("Skipped");
    expect(license?.stepStatus).toBe("required_missing");
    expect(license?.rows[0]?.subtitle).toMatch(/Incomplete \/ Required|No documents uploaded yet/);
  });

  it("shows required skipped references as required_missing on summary", () => {
    const config = buildConfig();
    const referencesStep = config.steps.find((s) => s.step_key === "references")!;
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: referencesStep.id, status: "skipped", completed_at: null, data: {} },
      ],
    };
    const sections = buildApplicantSummarySections(config, "zipstaff", snapshot({}), progress);
    const refs = sections.find((s) => s.id === "references");
    expect(refs?.stepStatus).toBe("required_missing");
    expect(refs?.complete).toBe(false);
    expect(refs?.rows[0]?.subtitle).toMatch(
      /Incomplete \/ Required|At least \d+ complete reference/
    );
  });
});
