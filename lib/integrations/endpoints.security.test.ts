import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { requireInboundApiAuth } from "./auth";
import { createInboundJob, searchInboundJob } from "./jobs";
import { searchInboundApplicant, uploadInboundApplicantResume } from "./applicants";
import { POST as createJob } from "@/app/api/v1/jobs/route";
import { GET as searchJob } from "@/app/api/v1/jobs/search/route";
import { GET as searchApplicant } from "@/app/api/v1/applicants/search/route";
import { POST as uploadResume } from "@/app/api/v1/applicants/resume/route";
vi.mock("./auth", () => ({ requireInboundApiAuth: vi.fn(), auditInboundApiCall: vi.fn() }));
vi.mock("./jobs", () => ({ createInboundJob: vi.fn(), searchInboundJob: vi.fn() }));
vi.mock("./applicants", () => ({ searchInboundApplicant: vi.fn(), uploadInboundApplicantResume: vi.fn() }));
const auth = { tenantId: "tenant-a", createdByUserId: "user-a", supabase: {} };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireInboundApiAuth).mockResolvedValue(auth as never);
});
describe("inbound route security", () => {
  it.each([401, 403, 429, 503])("stops every data endpoint when authorization returns %s", async (status) => {
    vi.mocked(requireInboundApiAuth).mockResolvedValue(NextResponse.json({}, { status }));
    for (const handler of [createJob, searchJob, searchApplicant, uploadResume]) {
      expect((await handler(new NextRequest("https://example.com/api/v1/test"))).status).toBe(status);
    }
    for (const service of [createInboundJob, searchInboundJob, searchInboundApplicant, uploadInboundApplicantResume]) expect(service).not.toHaveBeenCalled();
  });
  it("passes the key tenant to both search services", async () => {
    vi.mocked(searchInboundJob).mockResolvedValue(null);
    vi.mocked(searchInboundApplicant).mockResolvedValue(null);
    await searchJob(new NextRequest("https://example.com/api/v1/jobs/search?id=foreign-job"));
    await searchApplicant(new NextRequest("https://example.com/api/v1/applicants/search?email=foreign@example.com"));
    expect(searchInboundJob).toHaveBeenCalledWith({}, "tenant-a", expect.any(URLSearchParams));
    expect(searchInboundApplicant).toHaveBeenCalledWith({}, "tenant-a", expect.any(URLSearchParams));
  });
  it("ignores caller tenant and actor fields on writes", async () => {
    vi.mocked(createInboundJob).mockResolvedValue({ id: "job", title: "test", status: "draft", external_req_id: null, created: true });
    const response = await createJob(new NextRequest("https://example.com/api/v1/jobs", { method: "POST", body: JSON.stringify({ tenantId: "tenant-b", actorUserId: "attacker" }) }));
    expect(response.status).toBe(201);
    expect(createInboundJob).toHaveBeenCalledWith({}, expect.objectContaining({ tenantId: "tenant-a", actorUserId: "user-a" }));
  });
  it("hides internal job creation errors", async () => {
    vi.mocked(createInboundJob).mockRejectedValue(new Error("internal credential details"));
    const response = await createJob(new NextRequest("https://example.com/api/v1/jobs", { method: "POST", body: "{}" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("internal credential details");
  });
  it.each(["null", "[]", "bad json"])("rejects malformed job bodies: %s", async (body) => {
    expect((await createJob(new NextRequest("https://example.com/api/v1/jobs", { method: "POST", body }))).status).toBe(400);
    expect(createInboundJob).not.toHaveBeenCalled();
  });
});
