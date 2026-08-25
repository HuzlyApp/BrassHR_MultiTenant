import { describe, expect, it, vi } from "vitest";
import { listPublicJobs } from "@/lib/jobs/service";

function createListClient() {
  const eqCalls: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled, onRejected),
  });
  return {
    eqCalls,
    builder,
    client: { from: vi.fn(() => builder) },
  };
}

describe("listPublicJobs", () => {
  it("only lists published jobs for the requested tenant", async () => {
    const { client, eqCalls, builder } = createListClient();
    await listPublicJobs(client as never, "tenant-zipstaff", { query: "RN" });
    expect(client.from).toHaveBeenCalledWith("job_requisitions");
    expect(eqCalls).toContainEqual(["tenant_id", "tenant-zipstaff"]);
    expect(eqCalls).toContainEqual(["status", "published"]);
    expect(String((builder.select as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(
      "public_description"
    );
  });
});
