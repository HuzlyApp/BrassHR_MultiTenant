import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/jobs/application-statuses/service", () => ({
  changeApplicationStatusBySystemKey: vi.fn(async () => ({ unchanged: false })),
}));

vi.mock("@/lib/onboarding/activate-post-hire", () => ({
  activatePostHire: vi.fn(async () => ({
    activated: true,
    alreadyActive: false,
    skipped: false,
    skipReason: null,
    phase: "post_hire",
  })),
}));

import { convertCandidateToWorker } from "./convert-candidate-to-worker.server";
import { activatePostHire } from "@/lib/onboarding/activate-post-hire";
import { changeApplicationStatusBySystemKey } from "@/lib/jobs/application-statuses/service";

describe("convertCandidateToWorker server", () => {
  it("explains the missing assigned workflow without creating a worker or activating Post-Hire", async () => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "candidate", tenant_id: "tenant", status: "approved" }, error: null }) }) }) }));
    const rpc = vi.fn(async () => ({ data: null, error: { code: "23514", message: "Assign a matching W2 or 1099 workflow with pre-hire and post-hire steps before creating a worker." } }));
    expect(await convertCandidateToWorker({ from, rpc } as never, { candidateId: "candidate", workerType: "w2", sourceJobApplicationId: "application" })).toMatchObject({ ok: false, status: 409, code: "ONBOARDING_REQUIRED" });
    expect(from).toHaveBeenCalledTimes(1); expect(activatePostHire).not.toHaveBeenCalled();
  });
  it.each(["PGRST202", "42501", "23514"])("fails closed on RPC error %s without directly creating a worker", async (code) => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "candidate", tenant_id: "tenant", status: "approved" }, error: null }) }) }) }));
    const rpc = vi.fn(async () => ({ data: null, error: { code, message: "Guarded conversion failed" } }));
    const result = await convertCandidateToWorker({ from, rpc } as never, { candidateId: "candidate", workerType: "w2", sourceJobApplicationId: "application", actorUserId: "staff" });
    expect(result).toMatchObject({ ok: false, status: 503, code: "CONVERSION_UNAVAILABLE" });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("worker");
    expect(activatePostHire).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses RPC payload and activates post-hire", async () => {
    const supabase = {
      from(table: string) {
        if (table === "worker") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        id: "cand-1",
                        tenant_id: "tenant-1",
                        first_name: "A",
                        last_name: "B",
                        email: "a@b.com",
                        phone: null,
                        job_role: "CNA",
                        city: null,
                        state: null,
                        status: "approved",
                        converted_worker_type: null,
                        converted_at: null,
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }
        if (table === "job_applications") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        order() {
                          return {
                            order() {
                              return {
                                limit() {
                                  return {
                                    maybeSingle: async () => ({
                                      data: { id: "app-1" },
                                      error: null,
                                    }),
                                  };
                                },
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected ${table}`);
      },
      rpc: async () => ({
        data: {
          ok: true,
          created: true,
          workerRecordId: "emp-1",
          candidateId: "cand-1",
          workerType: "w2",
          sourceJobApplicationId: "app-1",
        },
        error: null,
      }),
    };

    const result = await convertCandidateToWorker(supabase as never, {
      candidateId: "cand-1",
      workerType: "w2",
      actorUserId: "user-1",
      origin: "https://example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.workerRecordId).toBe("emp-1");
      expect(result.postHire.activated).toBe(true);
    }
    expect(changeApplicationStatusBySystemKey).toHaveBeenCalled();
    expect(activatePostHire).toHaveBeenCalled();
  });

  it("returns existing worker idempotently from RPC", async () => {
    const supabase = {
      from(table: string) {
        if (table === "worker") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: {
                        id: "cand-1",
                        tenant_id: "tenant-1",
                        first_name: "A",
                        last_name: "B",
                        email: "a@b.com",
                        phone: null,
                        job_role: "CNA",
                        city: null,
                        state: null,
                        status: "converted",
                        converted_worker_type: "w2",
                        converted_at: "2026-01-01",
                      },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }
        if (table === "job_applications") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        order() {
                          return {
                            order() {
                              return {
                                limit() {
                                  return {
                                    maybeSingle: async () => ({ data: null, error: null }),
                                  };
                                },
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected ${table}`);
      },
      rpc: async () => ({
        data: {
          ok: true,
          created: false,
          workerRecordId: "emp-existing",
          candidateId: "cand-1",
          workerType: "w2",
          sourceJobApplicationId: null,
        },
        error: null,
      }),
    };

    const result = await convertCandidateToWorker(supabase as never, {
      candidateId: "cand-1",
      workerType: "w2",
      actorUserId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(false);
      expect(result.workerRecordId).toBe("emp-existing");
    }
  });
});
