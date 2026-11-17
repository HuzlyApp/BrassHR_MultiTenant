import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobValidationError } from "@/lib/jobs/types";

const prepareResumeCandidate = vi.fn();
const resolveAdminCandidateIdentity = vi.fn();

vi.mock("@/lib/jobs/admin-add-candidate-from-resume", () => ({
  prepareResumeCandidate: (...args: unknown[]) => prepareResumeCandidate(...args),
  resolveAdminCandidateIdentity: (...args: unknown[]) => resolveAdminCandidateIdentity(...args),
}));

vi.mock("@/lib/person-name", () => ({
  validatePersonName: (value: string) =>
    value?.trim()
      ? { ok: true as const, value: value.trim() }
      : { ok: false as const, error: "required" },
}));

import { uploadInboundApplicantResume } from "./applicants";

describe("uploadInboundApplicantResume parse/storage errors", () => {
  beforeEach(() => {
    prepareResumeCandidate.mockReset();
    resolveAdminCandidateIdentity.mockReset();
  });

  it("returns UNPROCESSABLE when parse fails even if storage upload fails", async () => {
    prepareResumeCandidate.mockResolvedValue({
      parsed: {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
      },
      resumeBytes: Buffer.from("%PDF"),
      resumeFileName: "resume.pdf",
      resumeContentType: "application/pdf",
      resumeFileType: "pdf",
      qualityOk: false,
      qualityMessage: "Could not parse",
      extractedText: "",
      parsedJson: {},
    });
    resolveAdminCandidateIdentity.mockReturnValue({
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      phone: "",
    });

    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({
            error: { message: "bucket unavailable" },
          }),
        })),
      },
    };

    await expect(
      uploadInboundApplicantResume(supabase as never, {
        tenantId: "tenant-a",
        actorUserId: "user-a",
        file: new File([Buffer.from("%PDF")], "resume.pdf", { type: "application/pdf" }),
        externalReqId: "REQ-1",
      })
    ).rejects.toMatchObject({
      name: "JobValidationError",
      code: "UNPROCESSABLE",
      fieldErrors: expect.objectContaining({
        name: "Could not parse name",
        email: "Could not parse email",
        storage: "Resume file could not be stored for manual review",
      }),
    });
  });

  it("maps storage failure to STORAGE_UNAVAILABLE when identity is valid", async () => {
    prepareResumeCandidate.mockResolvedValue({
      parsed: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone: "+15551234567",
      },
      resumeBytes: Buffer.from("%PDF"),
      resumeFileName: "resume.pdf",
      resumeContentType: "application/pdf",
      resumeFileType: "pdf",
      qualityOk: true,
      qualityMessage: null,
      extractedText: "Jane Doe",
      parsedJson: {},
    });
    resolveAdminCandidateIdentity.mockReturnValue({
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "+15551234567",
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        not: vi.fn().mockReturnThis(),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({
            error: { message: "bucket unavailable" },
          }),
        })),
      },
    };

    try {
      await uploadInboundApplicantResume(supabase as never, {
        tenantId: "tenant-a",
        actorUserId: "user-a",
        file: new File([Buffer.from("%PDF")], "resume.pdf", { type: "application/pdf" }),
      });
      throw new Error("expected STORAGE_UNAVAILABLE");
    } catch (error) {
      expect(error).toBeInstanceOf(JobValidationError);
      expect((error as JobValidationError).code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
