import { describe, expect, it, vi } from "vitest";
import { getPublishedJobByToken } from "./service";

function client(row: Record<string, unknown>) {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: row, error: null })) };
  return { db: { from: vi.fn(() => query) }, query };
}
describe("public job availability", () => {
  it.each(["paused", "closed", "filled"])("allows a published %s posting only for the read-only detail page", async (status) => {
    const { db, query } = client({ id: "job", status, published_at: "2026-11-23T00:00:00Z", application_deadline: null });
    expect(await getPublishedJobByToken(db as never, "tenant", "token")).toBeNull();
    expect(await getPublishedJobByToken(db as never, "tenant", "token", { includeUnavailable: true })).toMatchObject({ status });
    expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant");
    expect(query.eq).toHaveBeenCalledWith("public_job_token", "token");
    expect(query.in.mock.calls.at(-1)?.[1]).toEqual(["open", "published", "paused", "closed", "filled"]);
  });
  it("does not expose never-published closed postings", async () => {
    const { db } = client({ status: "closed", published_at: null });
    expect(await getPublishedJobByToken(db as never, "tenant", "token", { includeUnavailable: true })).toBeNull();
  });
  it("does not accept expired open jobs", async () => {
    const { db } = client({ status: "open", published_at: "2026-01-01", application_deadline: "2020-01-01" });
    expect(await getPublishedJobByToken(db as never, "tenant", "token")).toBeNull();
  });
});
