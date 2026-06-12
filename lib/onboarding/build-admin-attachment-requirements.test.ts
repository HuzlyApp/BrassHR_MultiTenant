import { describe, expect, it } from "vitest";
import {
  buildAdminAttachmentRequirements,
  legacyUrlForDocumentTitle,
} from "@/lib/onboarding/build-admin-attachment-requirements";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

function minimalConfig(
  steps: TenantOnboardingConfig["steps"],
  requiredDocuments: TenantOnboardingConfig["requiredDocuments"] = []
): TenantOnboardingConfig {
  return {
    configId: "cfg-1",
    tenantId: "tenant-1",
    version: 1,
    steps,
    requiredDocuments,
    skillAssessments: [],
  };
}

describe("legacyUrlForDocumentTitle", () => {
  it("maps known legacy document titles", () => {
    const legacy = {
      nursing_license_url: "https://x/license.pdf",
      tb_test_url: "https://x/tb.pdf",
      cpr_certification_url: null,
      authorization_document_url: null,
    };
    expect(legacyUrlForDocumentTitle("Nursing License", legacy)).toBe(legacy.nursing_license_url);
    expect(legacyUrlForDocumentTitle("TB Test", legacy)).toBe(legacy.tb_test_url);
  });
});

describe("buildAdminAttachmentRequirements", () => {
  const legacyUrls = {
    nursing_license_url: "https://legacy/license.pdf",
    tb_test_url: "https://legacy/tb.pdf",
    cpr_certification_url: "https://legacy/cpr.pdf",
    authorization_document_url: null,
  };

  it("only includes resume when flow is resume + references + summary", () => {
    const config = minimalConfig([
      {
        id: "s1",
        step_key: "resume_upload",
        title: "Add Resume",
        description: null,
        step_type: "resume_upload",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
      {
        id: "s2",
        step_key: "references",
        title: "Add References",
        description: null,
        step_type: "references",
        sort_order: 20,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
      {
        id: "s3",
        step_key: "summary",
        title: "Summary",
        description: null,
        step_type: "review_submit",
        sort_order: 30,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
    ]);

    const rows = buildAdminAttachmentRequirements({
      config,
      resumeUrl: "https://resume.pdf",
      resumePath: "a/resume.pdf",
      resumePathRaw: "a/resume.pdf",
      legacyUrls,
      submittedByRequiredId: new Map(),
      useLegacyFallback: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Add Resume");
    expect(rows[0]?.id).toBe("step-resume_upload");
  });

  it("assigns unique ids when multiple resume upload steps are enabled", () => {
    const config = minimalConfig([
      {
        id: "s1",
        step_key: "resume_upload",
        title: "Add Resume",
        description: null,
        step_type: "resume_upload",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
      {
        id: "s2",
        step_key: "resume_reupload",
        title: "Updated Resume",
        description: null,
        step_type: "resume_upload",
        sort_order: 15,
        is_required: false,
        is_enabled: true,
        metadata: {},
      },
    ]);

    const rows = buildAdminAttachmentRequirements({
      config,
      resumeUrl: "https://resume.pdf",
      resumePath: "a/resume.pdf",
      resumePathRaw: "a/resume.pdf",
      legacyUrls,
      submittedByRequiredId: new Map(),
      useLegacyFallback: false,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(["step-resume_upload", "step-resume_reupload"]);
  });

  it("includes configured required documents for professional license step", () => {
    const config = minimalConfig(
      [
        {
          id: "s1",
          step_key: "resume_upload",
          title: "Resume",
          description: null,
          step_type: "resume_upload",
          sort_order: 10,
          is_required: true,
          is_enabled: true,
          metadata: {},
        },
        {
          id: "s2",
          step_key: "professional_license",
          title: "Documents",
          description: null,
          step_type: "professional_license",
          sort_order: 20,
          is_required: true,
          is_enabled: true,
          metadata: {},
        },
      ],
      [
        {
          id: "doc-tb",
          onboarding_step_id: "s2",
          title: "TB Test",
          description: null,
          is_required: true,
          sort_order: 10,
          accepted_file_types: [],
          max_file_size_mb: 10,
        },
      ]
    );

    const submitted = new Map([
      [
        "doc-tb",
        {
          submitted_document_id: "submitted-doc-1",
          required_document_id: "doc-tb",
          signed_url: "https://signed/tb.pdf",
          original_file_name: "tb-result.pdf",
          status: "uploaded",
        },
      ],
    ]);

    const rows = buildAdminAttachmentRequirements({
      config,
      resumeUrl: null,
      resumePath: null,
      resumePathRaw: null,
      legacyUrls,
      submittedByRequiredId: submitted,
      useLegacyFallback: false,
    });

    expect(rows.map((r) => r.title)).toEqual(["Resume", "TB Test"]);
    expect(rows[1]?.url).toBe("https://signed/tb.pdf");
    expect(rows.some((r) => r.title === "Nursing License")).toBe(false);
  });

  it("omits disabled steps and their documents", () => {
    const config = minimalConfig(
      [
        {
          id: "s1",
          step_key: "resume_upload",
          title: "Resume",
          description: null,
          step_type: "resume_upload",
          sort_order: 10,
          is_required: true,
          is_enabled: true,
          metadata: {},
        },
        {
          id: "s2",
          step_key: "professional_license",
          title: "License docs",
          description: null,
          step_type: "professional_license",
          sort_order: 20,
          is_required: true,
          is_enabled: false,
          metadata: {},
        },
      ],
      [
        {
          id: "doc-license",
          onboarding_step_id: "s2",
          title: "Nursing License",
          description: null,
          is_required: true,
          sort_order: 10,
          accepted_file_types: [],
          max_file_size_mb: 10,
        },
      ]
    );

    const rows = buildAdminAttachmentRequirements({
      config,
      resumeUrl: null,
      resumePath: null,
      resumePathRaw: null,
      legacyUrls,
      submittedByRequiredId: new Map(),
      useLegacyFallback: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Resume");
  });
});
