import { describe, expect, it } from "vitest";
import {
  buildAssigneeFilterOptions,
  candidateMatchesAssigneeFilter,
  filterWorkerIdsByAssignee,
  UNASSIGNED_ASSIGNEE_FILTER,
} from "@/lib/candidates/assignee-filter";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("candidateMatchesAssigneeFilter", () => {
  it("passes through when no assignee filter is set", () => {
    expect(candidateMatchesAssigneeFilter("user-1", "")).toBe(true);
    expect(candidateMatchesAssigneeFilter(null, "  ")).toBe(true);
  });

  it("matches a specific assignee id", () => {
    expect(candidateMatchesAssigneeFilter("user-1", "user-1")).toBe(true);
    expect(candidateMatchesAssigneeFilter("user-2", "user-1")).toBe(false);
  });

  it("matches unassigned rows", () => {
    expect(candidateMatchesAssigneeFilter(null, UNASSIGNED_ASSIGNEE_FILTER)).toBe(true);
    expect(candidateMatchesAssigneeFilter("", UNASSIGNED_ASSIGNEE_FILTER)).toBe(true);
    expect(candidateMatchesAssigneeFilter("user-1", UNASSIGNED_ASSIGNEE_FILTER)).toBe(false);
  });
});

describe("buildAssigneeFilterOptions", () => {
  it("dedupes by id and sorts by label", () => {
    expect(
      buildAssigneeFilterOptions([
        { id: "b", name: "Zoe" },
        { id: "a", name: "Alex" },
        { id: "b", name: "Zoe Recruiter" },
        { id: "  ", name: "Skip" },
      ])
    ).toEqual([
      { value: "a", label: "Alex" },
      { value: "b", label: "Zoe Recruiter" },
    ]);
  });
});

const ASSIGNEE_V7 = "018d5c8a-7e3f-7c4a-8b2d-1a2b3c4d5e6f";
const WORKER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function thenableBuilder(data: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.not = chain;
  builder.order = chain;
  builder.is = chain;
  builder.range = chain;
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  return builder;
}

describe("filterWorkerIdsByAssignee", () => {
  it("returns empty for invalid assignee ids without querying", async () => {
    const from = () => {
      throw new Error("should not query");
    };
    await expect(
      filterWorkerIdsByAssignee(
        { from } as unknown as SupabaseClient,
        "tenant-a",
        [WORKER_A],
        "not-a-uuid"
      )
    ).resolves.toEqual([]);
  });

  it("keeps workers whose effective assignee matches, including uuid v7", async () => {
    const from = (table: string) => {
      if (table === "job_applications") {
        return thenableBuilder([
          {
            worker_id: WORKER_C,
            assigned_recruiter_user_id: ASSIGNEE_V7,
            updated_at: "2026-09-10T00:00:00.000Z",
          },
        ]);
      }
      return thenableBuilder([
        { id: WORKER_A, assigned_recruiter_user_id: ASSIGNEE_V7 },
        { id: WORKER_B, assigned_recruiter_user_id: "99999999-9999-4999-8999-999999999999" },
        { id: WORKER_C, assigned_recruiter_user_id: null },
      ]);
    };

    await expect(
      filterWorkerIdsByAssignee(
        { from } as unknown as SupabaseClient,
        "tenant-a",
        [WORKER_A, WORKER_B, WORKER_C],
        ASSIGNEE_V7
      )
    ).resolves.toEqual([WORKER_A, WORKER_C]);
  });

  it("keeps unassigned workers after application fallback", async () => {
    const from = (table: string) => {
      if (table === "job_applications") {
        return thenableBuilder([
          {
            worker_id: WORKER_B,
            assigned_recruiter_user_id: ASSIGNEE_V7,
            updated_at: "2026-09-10T00:00:00.000Z",
          },
        ]);
      }
      return thenableBuilder([
        { id: WORKER_A, assigned_recruiter_user_id: null },
        { id: WORKER_B, assigned_recruiter_user_id: null },
      ]);
    };

    await expect(
      filterWorkerIdsByAssignee(
        { from } as unknown as SupabaseClient,
        "tenant-a",
        [WORKER_A, WORKER_B],
        UNASSIGNED_ASSIGNEE_FILTER
      )
    ).resolves.toEqual([WORKER_A]);
  });
});
