import { describe, expect, it } from "vitest";
import { inferUploaderFromStoragePath } from "@/lib/applicant-portal/worker-document-service";

describe("inferUploaderFromStoragePath", () => {
  it("treats portal paths as worker uploads", () => {
    expect(
      inferUploaderFromStoragePath(
        "portal/11111111-1111-4111-8111-111111111111/other/file.pdf"
      )
    ).toEqual({ role: "Worker", userId: null });
  });

  it("treats admin paths as recruiter uploads and reads staff id when present", () => {
    const staffId = "22222222-2222-4222-8222-222222222222";
    expect(
      inferUploaderFromStoragePath(
        `tenant/worker/admin/${staffId}/drivers_license_url/file.pdf`
      )
    ).toEqual({ role: "Admin", userId: staffId });
  });

  it("treats older admin paths without a staff id as recruiter uploads", () => {
    expect(
      inferUploaderFromStoragePath("tenant/worker/admin/drivers_license_url/file.pdf")
    ).toEqual({ role: "Admin", userId: null });
  });
});
