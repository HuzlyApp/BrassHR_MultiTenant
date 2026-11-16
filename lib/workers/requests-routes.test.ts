import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), review: vi.fn() }));
vi.mock("./requests-context", () => ({ requireWorkerRequestContext: mocks.context,
  workerRequestError: () => NextResponse.json({ error: "Review failed" }, { status: 503 }) }));
vi.mock("./requests-service", () => ({ reviewWorkerRequest: mocks.review }));
import { POST as approve } from "@/app/api/v1/worker-requests/[id]/approve/route";
import { POST as reject } from "@/app/api/v1/worker-requests/[id]/reject/route";

const id = "10000000-0000-4000-8000-000000000001";
const route = { params: Promise.resolve({ id }) };
const request = (body?: string) => new Request(`https://example.test/api/v1/worker-requests/${id}/approve`, { method: "POST", body });
describe("worker request review routes", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ supabase: {}, tenantId: "tenant-a", auth: { userId: "reviewer-a" } }); });
  it("requires staff review authorization before parsing or mutating", async () => {
    mocks.context.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const req = request("{}");
    expect((await approve(req, route)).status).toBe(403);
    expect(mocks.context).toHaveBeenCalledWith(req, true);
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("accepts an empty optional review body and derives the actor from context", async () => {
    mocks.review.mockResolvedValue({ status: "approved" });
    expect((await approve(request(), route)).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith({}, "tenant-a", "reviewer-a", id, "approved", undefined);
  });
  it("rejects malformed JSON and reviewer injection before mutation", async () => {
    expect((await approve(request("{"), route)).status).toBe(422);
    expect((await approve(request(JSON.stringify({ notes: "OK", reviewed_by: "forged" })), route)).status).toBe(422);
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it("uses a fixed rejection decision and carries reviewer notes", async () => {
    mocks.review.mockResolvedValue({ status: "rejected" });
    expect((await reject(request(JSON.stringify({ notes: "Denied" })), route)).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith({}, "tenant-a", "reviewer-a", id, "rejected", "Denied");
  });
});
