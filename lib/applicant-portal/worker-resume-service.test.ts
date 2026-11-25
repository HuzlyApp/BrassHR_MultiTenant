import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicantWorkerRow } from "@/lib/applicant-portal";

vi.mock("@/lib/jobs/match-analysis/extract-resume-text", () => ({
  extractResumeTextFromUpload: vi.fn(async () =>
    "Jane Doe jane@example.com Professional summary: Registered nurse with ten years of experience. Education: Nursing degree. Skills: patient care."
  ),
}));
vi.mock("@/lib/onboarding/persist-worker-resume-record", () => ({
  persistWorkerResumeRecord: vi.fn(async () => "resume-1"),
  softDeleteWorkerResumeRecord: vi.fn(),
}));
vi.mock("@/lib/onboarding/sync-worker-primary-resume-path", () => ({
  syncWorkerPrimaryResumePath: vi.fn(async () => undefined),
}));
vi.mock("@/lib/resume/assert-resume-upload-limit", () => ({
  assertResumeUploadWithinLimit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/resume/schedule-uploaded-resume-processing", () => ({
  scheduleUploadedResumeProcessing: vi.fn(),
}));

import { uploadWorkerResumeForApplicant } from "./worker-resume-service";
import { persistWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record";
import { assertResumeUploadWithinLimit } from "@/lib/resume/assert-resume-upload-limit";
import { scheduleUploadedResumeProcessing } from "@/lib/resume/schedule-uploaded-resume-processing";

const applicant = { id: "worker-1", user_id: "user-1", tenant_id: "tenant-1" } as ApplicantWorkerRow;
const file = () => new File(["resume contents"], "resume.pdf", { type: "application/pdf" });

describe("candidate resume uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores and schedules parsing of a profile resume before the first application", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const from = vi.fn();
    const sb = { from, storage: { from: () => ({ upload }) } } as unknown as SupabaseClient;

    await expect(uploadWorkerResumeForApplicant(sb, applicant, "user-1", file()))
      .resolves.toEqual({ resumeId: "resume-1", parseStatus: "processing" });

    expect(from).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledOnce();
    expect(assertResumeUploadWithinLimit).toHaveBeenCalledWith(sb, expect.objectContaining({ workerId: "worker-1", role: "worker" }));
    expect(persistWorkerResumeRecord).toHaveBeenCalledWith(sb, "worker-1", expect.objectContaining({
      workerId: "worker-1", tenantId: "tenant-1", jobApplicationId: null,
    }), { mode: "insert" });
    expect(scheduleUploadedResumeProcessing).toHaveBeenCalledWith(expect.objectContaining({
      resumeId: "resume-1", tenantId: "tenant-1", jobApplicationId: "",
    }));
  });

  it("still rejects an application outside the authenticated worker and tenant", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    const sb = { from: vi.fn(() => query) } as unknown as SupabaseClient;
    await expect(uploadWorkerResumeForApplicant(sb, applicant, "user-1", file(), "other-application"))
      .rejects.toThrow("Select a valid job from your applications.");
    expect(query.eq.mock.calls).toEqual([
      ["id", "other-application"], ["worker_id", "worker-1"], ["tenant_id", "tenant-1"],
    ]);
    expect(persistWorkerResumeRecord).not.toHaveBeenCalled();
  });

  it("still enforces the upload limit on profile resumes", async () => {
    vi.mocked(assertResumeUploadWithinLimit).mockRejectedValueOnce(new Error("Upload limit reached"));
    await expect(uploadWorkerResumeForApplicant({} as SupabaseClient, applicant, "user-1", file()))
      .rejects.toThrow("Upload limit reached");
    expect(persistWorkerResumeRecord).not.toHaveBeenCalled();
  });
});
