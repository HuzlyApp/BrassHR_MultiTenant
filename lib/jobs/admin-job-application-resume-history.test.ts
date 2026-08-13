import { describe, expect, it } from "vitest";
import { loadAdminJobApplicationResumeHistory } from "@/lib/jobs/admin-job-application-resume-history";

describe("loadAdminJobApplicationResumeHistory", () => {
  it("returns resumes oldest-first with uploader names", async () => {
    const applicationId = "app-1";
    const workerId = "worker-1";
    const workerUserId = "user-worker";
    const staffUserId = "user-staff";

    const supabase = {
      from(table: string) {
        const state: { table: string } = { table };
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
          in() {
            return api;
          },
          order() {
            if (state.table === "worker_resumes") {
              return Promise.resolve({
                data: [
                    {
                      id: "resume-1",
                      original_file_name: "2025 Resume.pdf",
                      file_name: null,
                      file_type: "application/pdf",
                      uploaded_at: "2026-08-13T10:00:00.000Z",
                      uploaded_by_user_id: workerUserId,
                    },
                    {
                      id: "resume-2",
                      original_file_name: "ResumeHaileySparks.pdf",
                      file_name: null,
                      file_type: "application/pdf",
                      uploaded_at: "2026-08-13T11:00:00.000Z",
                      uploaded_by_user_id: staffUserId,
                    },
                ],
                error: null,
              });
            }
            return api;
          },
          maybeSingle: async () => {
            if (state.table === "job_applications") {
              return {
                data: {
                  id: applicationId,
                  worker_id: workerId,
                  job_requisitions: {
                    public_title: "Certified Nursing Assistant (CNA)",
                    source_job_title: null,
                    source_type: null,
                    employment_type: null,
                    location: null,
                  },
                },
                error: null,
              };
            }
            if (state.table === "worker") {
              return {
                data: {
                  id: workerId,
                  user_id: workerUserId,
                  first_name: "Shawnda",
                  last_name: "Watkins",
                  profile_photo: null,
                },
                error: null,
              };
            }
            return { data: null, error: null };
          },
          then(onFulfilled: (value: unknown) => unknown) {
            if (state.table === "users") {
              return Promise.resolve(
                onFulfilled({
                  data: [{ id: staffUserId, first_name: "Test", last_name: "User", profile_photo: null }],
                  error: null,
                })
              );
            }
            return Promise.resolve(onFulfilled({ data: [], error: null }));
          },
        };
        return api;
      },
    };

    const result = await loadAdminJobApplicationResumeHistory(
      supabase as never,
      "tenant-1",
      applicationId
    );

    expect(result?.jobTitle).toBe("Certified Nursing Assistant (CNA)");
    expect(result?.resumes).toHaveLength(2);
    expect(result?.resumes[0]?.fileName).toBe("2025 Resume.pdf");
    expect(result?.resumes[0]?.fileIconType).toBe("pdf");
    expect(result?.resumes[0]?.uploadedByName).toBe("Shawnda Watkins");
    expect(result?.resumes[0]?.uploadedByType).toBe("worker");
    expect(result?.resumes[1]?.uploadedByName).toBe("Test User");
    expect(result?.resumes[1]?.uploadedByType).toBe("staff");
  });
});
