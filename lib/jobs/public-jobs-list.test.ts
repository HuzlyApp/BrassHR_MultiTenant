import { describe, expect, it, vi } from "vitest";
import { listPublicJobs } from "@/lib/jobs/service";

function createListClient() {
  const eqCalls: Array<[string, unknown]> = [];
  const inCalls: Array<[string, unknown]> = [];
  const notCalls: Array<[string, string, unknown]> = [];
  const neqCalls: Array<[string, unknown]> = [];
  const orCalls: string[] = [];
  const orderCalls: Array<[string, Record<string, unknown>?]> = [];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    in: vi.fn((column: string, value: unknown) => {
      inCalls.push([column, value]);
      return builder;
    }),
    not: vi.fn((column: string, operator: string, value: unknown) => {
      notCalls.push([column, operator, value]);
      return builder;
    }),
    neq: vi.fn((column: string, value: unknown) => {
      neqCalls.push([column, value]);
      return builder;
    }),
    or: vi.fn((filters: string) => {
      orCalls.push(filters);
      return builder;
    }),
    order: vi.fn((column: string, options?: Record<string, unknown>) => {
      orderCalls.push([column, options]);
      return builder;
    }),
    range: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled, onRejected),
  });
  return {
    eqCalls,
    inCalls,
    notCalls,
    neqCalls,
    orCalls,
    orderCalls,
    builder,
    client: { from: vi.fn(() => builder) },
  };
}

describe("listPublicJobs", () => {
  it("only lists open jobs for the requested tenant", async () => {
    const { client, eqCalls, inCalls, builder } = createListClient();
    await listPublicJobs(client as never, "tenant-zipstaff", { query: "RN" });
    expect(client.from).toHaveBeenCalledWith("job_requisitions");
    expect(eqCalls).toContainEqual(["tenant_id", "tenant-zipstaff"]);
    expect(inCalls).toContainEqual(["status", ["open", "published"]]);
    expect(String((builder.select as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(
      "public_description"
    );
  });

  it("requires a public job token and matches workplace via location_type or schedule", async () => {
    const { client, notCalls, neqCalls, orCalls } = createListClient();
    await listPublicJobs(client as never, "tenant-zipstaff", { locationType: "Remote, Hybrid" });
    expect(notCalls).toContainEqual(["public_job_token", "is", null]);
    expect(neqCalls).toContainEqual(["public_job_token", ""]);
    expect(orCalls.some((filters) => filters.includes('location_type.eq."Remote, Hybrid"'))).toBe(
      true
    );
    expect(
      orCalls.some((filters) =>
        filters.includes('and(location_type.is.null,schedule.eq."Remote, Hybrid")')
      )
    ).toBe(true);
  });

  it("orders by latest activity for Most recent", async () => {
    const { client, orderCalls } = createListClient();
    await listPublicJobs(client as never, "tenant-zipstaff");
    expect(orderCalls[0]?.[0]).toBe("updated_at");
    expect(orderCalls[0]?.[1]).toMatchObject({ ascending: false });
    expect(orderCalls[1]?.[0]).toBe("published_at");
  });
});
