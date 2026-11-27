import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicantWorkerRow } from "@/lib/applicant-portal";

vi.mock("@/lib/resume/schedule-uploaded-resume-processing", () => ({ scheduleUploadedResumeProcessing: vi.fn() }));
import { importApplicantApplicationResume } from "./application-resume";
import { scheduleUploadedResumeProcessing } from "@/lib/resume/schedule-uploaded-resume-processing";

const applicant = { id: "worker-1", tenant_id: "tenant-1" } as ApplicantWorkerRow;

function setup({ application = true, resume = true, status = "completed" } = {}) {
  const source = { file_url: "worker-1/resume.pdf", original_file_name: "resume.pdf", parsing_status: status, extracted_text: "Resume text", parsed_json: { skills: ["Nursing"] } };
  const queries: { table: string; filters: unknown[][] }[] = [];
  const insert = vi.fn();
  const sb = { from: (table: string) => {
    const filters: unknown[][] = [];
    queries.push({ table, filters });
    let inserting = false;
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { filters.push(args); return query; },
      is: (...args: unknown[]) => { filters.push(args); return query; },
      insert: (value: unknown) => { insert(value); inserting = true; return query; },
      maybeSingle: async () => ({ data: table === "job_applications" ? (application ? { id: "app-1" } : null) : (resume ? source : null), error: null }),
      single: async () => ({ data: inserting ? { id: "copy-1" } : null, error: null }),
    };
    return query;
  } } as unknown as SupabaseClient;
  return { sb, queries, insert, source };
}

describe("candidate application resume import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies a saved resume into this job without changing the original", async () => {
    const { sb, insert, queries, source } = setup();
    await expect(importApplicantApplicationResume(sb, applicant, "user-1", "app-1", "resume-1")).resolves.toEqual({ resumeId: "copy-1" });
    expect(queries[0].filters).toEqual([["id", "app-1"], ["worker_id", "worker-1"], ["tenant_id", "tenant-1"]]);
    expect(queries[1].filters).toEqual([["id", "resume-1"], ["worker_id", "worker-1"], ["tenant_id", "tenant-1"], ["deleted_at", null]]);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ ...source, worker_id: "worker-1", tenant_id: "tenant-1", job_application_id: "app-1", uploaded_by_user_id: "user-1" }));
    expect(source).not.toHaveProperty("job_application_id");
    expect(scheduleUploadedResumeProcessing).toHaveBeenCalledWith(expect.objectContaining({ jobApplicationId: "app-1", resumeId: "copy-1", skipParse: true }));
  });

  it.each([
    [{ application: false }, "Application not found"],
    [{ resume: false }, "Select a resume from your saved resumes"],
    [{ status: "processing" }, "finish parsing"],
  ])("rejects inaccessible or unready inputs: %j", async (options, message) => {
    const { sb, insert } = setup(options);
    await expect(importApplicantApplicationResume(sb, applicant, "user-1", "app-1", "resume-1")).rejects.toThrow(message);
    expect(insert).not.toHaveBeenCalled();
    expect(scheduleUploadedResumeProcessing).not.toHaveBeenCalled();
  });
});
