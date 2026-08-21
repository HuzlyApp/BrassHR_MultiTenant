import { describe, expect, it } from "vitest";
import {
  classifyResumeUploaderRole,
  countResumeUploadsForRole,
  MAX_RESUME_UPLOADS_PER_ROLE,
  resumeUploadLimitMessage,
} from "@/lib/resume/resume-upload-limit";
import { assertResumeUploadWithinLimit } from "@/lib/resume/assert-resume-upload-limit";
import {
  isReuploadedResumePath,
  resumeUploadFolder,
} from "@/lib/resume/resume-reupload-path";

describe("classifyResumeUploaderRole", () => {
  it("treats missing uploader as worker", () => {
    expect(classifyResumeUploaderRole(null, "user-worker")).toBe("worker");
  });

  it("treats the worker auth user as worker", () => {
    expect(classifyResumeUploaderRole("user-worker", "user-worker")).toBe("worker");
  });

  it("treats a different uploader as admin", () => {
    expect(classifyResumeUploaderRole("user-staff", "user-worker")).toBe("admin");
  });
});

describe("countResumeUploadsForRole", () => {
  const rows = [
    { uploaded_by_user_id: "user-worker" },
    { uploaded_by_user_id: "user-worker" },
    { uploaded_by_user_id: "user-staff" },
    { uploaded_by_user_id: null },
  ];

  it("counts worker uploads including legacy rows with no uploader", () => {
    expect(countResumeUploadsForRole(rows, "worker", "user-worker")).toBe(3);
  });

  it("counts admin uploads from history separately", () => {
    expect(countResumeUploadsForRole(rows, "admin", "user-worker")).toBe(1);
  });
});

describe("assertResumeUploadWithinLimit", () => {
  function mockSupabase(rows: Array<{ uploaded_by_user_id: string | null }>) {
    const api = {
      select() {
        return api;
      },
      eq() {
        return api;
      },
      is() {
        return api;
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return { from: () => api };
  }

  it("allows worker uploads under the limit", async () => {
    const supabase = mockSupabase(
      Array.from({ length: 4 }, () => ({ uploaded_by_user_id: "user-worker" }))
    );
    await expect(
      assertResumeUploadWithinLimit(supabase as never, {
        workerId: "worker-1",
        workerUserId: "user-worker",
        uploadedByUserId: "user-worker",
        role: "worker",
      })
    ).resolves.toBeUndefined();
  });

  it("blocks a 6th worker upload even when the resumes span different jobs", async () => {
    const supabase = mockSupabase(
      Array.from({ length: MAX_RESUME_UPLOADS_PER_ROLE }, () => ({
        uploaded_by_user_id: "user-worker",
      }))
    );
    await expect(
      assertResumeUploadWithinLimit(supabase as never, {
        workerId: "worker-1",
        workerUserId: "user-worker",
        uploadedByUserId: "user-worker",
        role: "worker",
      })
    ).rejects.toThrow(resumeUploadLimitMessage("worker"));
  });

  it("blocks a 6th admin upload using history rows", async () => {
    const supabase = mockSupabase([
      ...Array.from({ length: MAX_RESUME_UPLOADS_PER_ROLE }, () => ({
        uploaded_by_user_id: "user-staff",
      })),
      { uploaded_by_user_id: "user-worker" },
    ]);
    await expect(
      assertResumeUploadWithinLimit(supabase as never, {
        workerId: "worker-1",
        workerUserId: "user-worker",
        uploadedByUserId: "user-staff",
        role: "admin",
      })
    ).rejects.toThrow(resumeUploadLimitMessage("admin"));
  });

  it("does not count worker uploads against the admin limit", async () => {
    const supabase = mockSupabase(
      Array.from({ length: MAX_RESUME_UPLOADS_PER_ROLE }, () => ({
        uploaded_by_user_id: "user-worker",
      }))
    );
    await expect(
      assertResumeUploadWithinLimit(supabase as never, {
        workerId: "worker-1",
        workerUserId: "user-worker",
        uploadedByUserId: "user-staff",
        role: "admin",
      })
    ).resolves.toBeUndefined();
  });
});

describe("resume reupload storage paths", () => {
  it("keeps the owner folder first so bucket policies still match", () => {
    expect(resumeUploadFolder("user-worker", true)).toBe("user-worker/reuploads");
    expect(resumeUploadFolder("user-worker", false)).toBe("user-worker");
  });

  it("flags reuploaded files and leaves first uploads alone", () => {
    expect(isReuploadedResumePath("user-worker/reuploads/abc-Resume.pdf")).toBe(true);
    expect(isReuploadedResumePath("user-worker/abc-Resume.pdf")).toBe(false);
  });

  it("falls back to file_url when storage_path is empty", () => {
    expect(isReuploadedResumePath(null, "worker-1/reuploads/abc-Resume.pdf")).toBe(true);
    expect(isReuploadedResumePath(null, null)).toBe(false);
  });

  it("does not flag a file whose name merely contains the folder word", () => {
    expect(isReuploadedResumePath("user-worker/abc-reuploads-Resume.pdf")).toBe(false);
  });
});
