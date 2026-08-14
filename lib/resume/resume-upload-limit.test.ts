import { describe, expect, it } from "vitest";
import {
  classifyResumeUploaderRole,
  countResumeUploadsForRole,
  MAX_RESUME_UPLOADS_PER_ROLE,
  resumeUploadLimitMessage,
} from "@/lib/resume/resume-upload-limit";
import { assertResumeUploadWithinLimit } from "@/lib/resume/assert-resume-upload-limit";

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
        jobApplicationId: "app-1",
        uploadedByUserId: "user-worker",
        role: "worker",
      })
    ).resolves.toBeUndefined();
  });

  it("blocks a 6th worker upload for the same job", async () => {
    const supabase = mockSupabase(
      Array.from({ length: MAX_RESUME_UPLOADS_PER_ROLE }, () => ({
        uploaded_by_user_id: "user-worker",
      }))
    );
    await expect(
      assertResumeUploadWithinLimit(supabase as never, {
        workerId: "worker-1",
        workerUserId: "user-worker",
        jobApplicationId: "app-1",
        uploadedByUserId: "user-worker",
        role: "worker",
      })
    ).rejects.toThrow(/up to 5 times/i);
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
        jobApplicationId: "app-1",
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
        jobApplicationId: "app-1",
        uploadedByUserId: "user-staff",
        role: "admin",
      })
    ).resolves.toBeUndefined();
  });
});
