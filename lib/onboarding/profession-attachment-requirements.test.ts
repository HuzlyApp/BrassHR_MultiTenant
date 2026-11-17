import { describe, expect, it } from "vitest";
import { applyProfessionDocumentsToAttachments } from "@/lib/onboarding/profession-attachment-requirements";
import type { AdminAttachmentRequirement } from "@/lib/onboarding/build-admin-attachment-requirements";

const legacy = {
  nursing_license_url: "https://files/nursing.pdf",
  tb_test_url: "https://files/tb.pdf",
  cpr_certification_url: null,
  authorization_document_url: "https://files/auth.pdf",
  drivers_license_url: null,
};

function row(partial: Partial<AdminAttachmentRequirement> & Pick<AdminAttachmentRequirement, "id" | "title" | "step_type">): AdminAttachmentRequirement {
  return {
    step_key: partial.step_type,
    phase: "pre_hire",
    required_document_id: null,
    submitted_document_id: null,
    legacy_document_key: null,
    status: null,
    url: null,
    filename: "—",
    sort_order: 0,
    ...partial,
  };
}

describe("applyProfessionDocumentsToAttachments", () => {
  it("replaces the fixed license slots with the profession certificate and license list", () => {
    const rows = applyProfessionDocumentsToAttachments(
      [
        row({ id: "resume", title: "Upload Resume", step_type: "resume_upload", url: "https://files/resume.pdf" }),
        row({ id: "license", title: "Nursing License", step_type: "professional_license" }),
        row({ id: "tb", title: "TB Test", step_type: "professional_license" }),
        row({ id: "cpr", title: "CPR Certifications", step_type: "professional_license" }),
        row({ id: "authorization", title: "Authorization", step_type: "authorizations", url: legacy.authorization_document_url }),
      ],
      [
        {
          id: "lic",
          name: "Nursing license",
          documentKind: "license",
          isRequired: true,
          hasExpiration: true,
          sortOrder: 10,
        },
        {
          id: "bls",
          name: "BLS",
          documentKind: "certificate",
          isRequired: true,
          hasExpiration: true,
          sortOrder: 30,
        },
        {
          id: "acls",
          name: "ACLS",
          documentKind: "certificate",
          isRequired: false,
          hasExpiration: true,
          sortOrder: 40,
        },
      ],
      new Map([
        [
          "bls",
          [
            {
              id: "upload-1",
              signedUrl: "https://files/bls.pdf",
              originalFileName: "bls.pdf",
              status: "uploaded",
            },
          ],
        ],
      ]),
      legacy
    );

    expect(rows.map((item) => item.title)).toEqual([
      "Upload Resume",
      "Nursing license",
      "BLS",
      "ACLS",
      "Authorization",
    ]);
    expect(rows[1]).toMatchObject({
      document_kind: "license",
      is_required: true,
      url: "https://files/nursing.pdf",
      required_document_id: "lic",
    });
    expect(rows[2]).toMatchObject({ url: "https://files/bls.pdf", filename: "bls.pdf" });
    expect(rows[3]).toMatchObject({ is_required: false, document_kind: "certificate", url: null });
    expect(rows[4]).toMatchObject({
      title: "Authorization",
      url: legacy.authorization_document_url,
    });
  });

  it("maps same-name workflow uploads onto settings and keeps other uploaded workflow docs", () => {
    const rows = applyProfessionDocumentsToAttachments(
      [
        row({ id: "resume", title: "Upload Resume", step_type: "resume_upload", url: "https://files/resume.pdf" }),
        row({
          id: "license",
          title: "Nursing License",
          step_type: "professional_license",
          url: "https://files/uploaded-license.pdf",
          filename: "license.pdf",
          status: "uploaded",
          submitted_document_id: "submitted-1",
        }),
        row({ id: "ssn", title: "SSN Card", step_type: "authorizations" }),
        row({
          id: "work-auth",
          title: "Work Authorization",
          step_type: "document_upload",
          phase: "pre_hire",
          url: "https://files/work-auth.doc",
          filename: "Work auth.doc",
          status: "uploaded",
          uploaded_by: "staff-1",
        }),
      ],
      [
        {
          id: "lic",
          name: "Nursing license",
          documentKind: "license",
          isRequired: true,
          hasExpiration: true,
          sortOrder: 10,
        },
      ],
      new Map(),
      legacy
    );

    expect(rows.map((item) => item.title)).toEqual([
      "Upload Resume",
      "Nursing license",
      "Work Authorization",
    ]);
    expect(rows[1]).toMatchObject({
      url: "https://files/uploaded-license.pdf",
      filename: "license.pdf",
      submitted_document_id: "submitted-1",
    });
    expect(rows[2]).toMatchObject({
      title: "Work Authorization",
      url: "https://files/work-auth.doc",
      uploaded_by: "staff-1",
    });
  });

  it("shows only the resume when settings has no documents and workflow slots are empty", () => {
    const rows = applyProfessionDocumentsToAttachments(
      [
        row({ id: "resume", title: "Upload Resume", step_type: "resume_upload" }),
        row({ id: "license", title: "Nursing License", step_type: "professional_license" }),
        row({ id: "ssn", title: "SSN Card", step_type: "authorizations" }),
      ],
      [],
      new Map(),
      legacy
    );

    expect(rows.map((item) => item.title)).toEqual(["Upload Resume"]);
  });
});
