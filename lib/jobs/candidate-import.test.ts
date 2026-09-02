import { beforeEach, describe, expect, it, vi } from "vitest";

const writeActivityLog = vi.fn(async (..._args: unknown[]) => undefined);

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLog(...args),
}));

vi.mock("@/lib/jobs/service", () => ({
  resolvePublishedFlowForJobWorkflow: vi.fn(async () => ({
    id: "flow-1",
    name: "Default",
    builderDraft: { nodes: [], edges: [] },
    updatedAt: "2026-09-01T00:00:00.000Z",
  })),
  attachWorkflowInstanceToApplication: vi.fn(async () => ({ id: "app-1" })),
}));

import { CandidateImportError, importExistingCandidatesToWorkspace } from "./candidate-import";

type ApplicationRow = {
  worker_id: string;
  job_requisition_id: string;
  status: string;
};

function chain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "in",
    "not",
    "is",
    "or",
    "ilike",
    "order",
    "limit",
    "update",
  ];
  for (const method of methods) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = async () => ({ data: result.data ?? null, error: result.error ?? null });
  builder.single = async () => ({ data: result.data ?? null, error: result.error ?? null });
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown
  ) =>
    Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    }).then(resolve, reject);
  return builder;
}

function createFakeSupabase(state: {
  job?: Record<string, unknown> | null;
  workers: Array<Record<string, unknown>>;
  applications: ApplicationRow[];
  profiles: Array<{ id: string; worker_id: string }>;
  inserted: Array<Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      if (table === "job_requisitions") {
        return chain({ data: state.job });
      }
      if (table === "job_applications") {
        return {
          select() {
            return chain({
              data: state.applications.map((row) => ({ worker_id: row.worker_id })),
            });
          },
          insert(payload: Record<string, unknown>) {
            const workerId = String(payload.worker_id ?? "");
            const already = state.applications.some(
              (row) => row.worker_id === workerId && row.status !== "withdrawn"
            );
            if (already) {
              return chain({
                data: null,
                error: { code: "23505", message: "duplicate key" },
              });
            }
            state.inserted.push(payload);
            state.applications.push({
              worker_id: workerId,
              job_requisition_id: String(payload.job_requisition_id ?? ""),
              status: "new",
            });
            return chain({ data: { id: `app-${workerId}` } });
          },
          delete() {
            return chain({ data: null });
          },
        };
      }
      if (table === "worker") {
        return {
          select() {
            return {
              eq() {
                return {
                  in: async (_col: string, ids: string[]) => ({
                    data: state.workers.filter((row) => ids.includes(String(row.id))),
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "applicant_profiles") {
        return {
          select() {
            return chain({ data: state.profiles[0] ?? null });
          },
          insert() {
            return chain({ data: { id: "profile-new" } });
          },
          update() {
            return chain({ data: null });
          },
        };
      }
      if (table === "worker_resumes") {
        return chain({
          data: [
            {
              worker_id: "11111111-1111-4111-8111-111111111111",
              extracted_text: "A".repeat(50),
            },
          ],
        });
      }
      if (table === "recruiter_activity_logs") {
        return { insert: async () => ({ error: null }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const JOB = {
  id: "22222222-2222-4222-8222-222222222222",
  tenant_id: "tenant-1",
  public_title: "ICU RN",
  internal_requisition_number: "REQ-100",
  status: "published",
  workflow_id: "flow-1",
  professions: { name: "Nursing" },
  specialties: { name: "ICU" },
};

const WORKER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";

describe("importExistingCandidatesToWorkspace", () => {
  beforeEach(() => {
    writeActivityLog.mockClear();
  });

  it("rejects non-uuid candidate ids", async () => {
    const supabase = createFakeSupabase({
      job: JOB,
      workers: [],
      applications: [],
      profiles: [],
      inserted: [],
    });
    await expect(
      importExistingCandidatesToWorkspace(supabase as never, {
        tenantId: "tenant-1",
        jobId: JOB.id,
        staffUserId: "recruiter-1",
        candidateIds: ["John Smith"],
      })
    ).rejects.toMatchObject({
      code: "INVALID_ID",
      message: "Each candidate must be referenced by its database ID.",
    });
  });

  it("skips candidates already on the job and missing tenant workers", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const supabase = createFakeSupabase({
      job: JOB,
      workers: [
        {
          id: WORKER_ID,
          first_name: "Jordan",
          last_name: "Lee",
          email: "jordan@clinic.org",
          phone: null,
          job_role: "ICU RN",
        },
      ],
      applications: [{ worker_id: OTHER_ID, job_requisition_id: JOB.id, status: "new" }],
      profiles: [{ id: "profile-1", worker_id: WORKER_ID }],
      inserted,
    });

    const result = await importExistingCandidatesToWorkspace(supabase as never, {
      tenantId: "tenant-1",
      jobId: JOB.id,
      staffUserId: "recruiter-1",
      candidateIds: [WORKER_ID, OTHER_ID, "44444444-4444-4444-8444-444444444444"],
    });

    expect(result.imported).toEqual([WORKER_ID]);
    expect(result.skippedAlreadyAdded).toEqual([OTHER_ID]);
    expect(result.skippedNotFound).toEqual(["44444444-4444-4444-8444-444444444444"]);
    expect(result.message).toContain("1 candidate");
    expect(inserted[0]).toMatchObject({
      worker_id: WORKER_ID,
      status: "new",
      source: "admin",
      ai_match_status: "READY",
    });
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CANDIDATES_IMPORTED_TO_JOB" })
    );
  });

  it("returns 404 when the job is missing", async () => {
    const supabase = createFakeSupabase({
      job: null,
      workers: [],
      applications: [],
      profiles: [],
      inserted: [],
    });
    await expect(
      importExistingCandidatesToWorkspace(supabase as never, {
        tenantId: "tenant-1",
        jobId: JOB.id,
        staffUserId: "recruiter-1",
        candidateIds: [WORKER_ID],
      })
    ).rejects.toBeInstanceOf(CandidateImportError);
  });
});
