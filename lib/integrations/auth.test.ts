import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { requireInboundApiAuth } from "./auth";
import { verifyInboundApiKey, touchApiKeyLastUsed } from "./api-keys";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { writeActivityLog } from "@/lib/audit/activity-log";

vi.mock("./api-keys", () => ({ verifyInboundApiKey: vi.fn(), touchApiKeyLastUsed: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: vi.fn(), envRateLimit: (_: string, fallback: number) => fallback }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/audit/activity-log", () => ({ writeActivityLog: vi.fn() }));

const secret = `bhr_in_${"a".repeat(32)}`;
const key = { id: "key-a", tenantId: "tenant-a", name: "test", keyPrefix: secret.slice(0, 12), scopes: ["inbound"], createdByUserId: null, lastUsedAt: null, revokedAt: null, createdAt: "", keyHash: "hash" };
const request = (headers: Record<string, string> = {}) => new NextRequest("https://example.com/api/v1/jobs/search?id=job", { headers });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
  vi.mocked(verifyInboundApiKey).mockResolvedValue(key);
  vi.mocked(enforceRateLimit).mockResolvedValue(null);
  vi.mocked(touchApiKeyLastUsed).mockResolvedValue();
  vi.mocked(writeActivityLog).mockResolvedValue();
});

describe("inbound authentication boundaries", () => {
  it.each([{ "x-api-key": secret }, { authorization: `Bearer ${secret}` }, { authorization: `bearer ${secret}` }])("accepts supported credentials: %j", async (headers) => {
    const result = await requireInboundApiAuth(request(headers), { kind: "search" });
    expect(result).toMatchObject({ tenantId: "tenant-a", apiKeyId: "key-a" });
    expect(touchApiKeyLastUsed).toHaveBeenCalledWith({}, "key-a");
  });
  it.each([{}, { authorization: "Basic abc" }])("rejects missing credentials %j", async (headers) => {
    expect(await requireInboundApiAuth(request(headers), { kind: "write" })).toHaveProperty("status", 401);
    expect(verifyInboundApiKey).not.toHaveBeenCalled();
  });
  it("rejects conflicting credential headers", async () => {
    expect(await requireInboundApiAuth(request({ "x-api-key": secret, authorization: `Bearer bhr_in_${"b".repeat(32)}` }), { kind: "write" })).toHaveProperty("status", 401);
    expect(verifyInboundApiKey).not.toHaveBeenCalled();
  });
  it("rejects unknown or revoked keys without touching usage", async () => {
    vi.mocked(verifyInboundApiKey).mockResolvedValue(null);
    expect(await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" })).toHaveProperty("status", 401);
    expect(touchApiKeyLastUsed).not.toHaveBeenCalled();
  });
  it.each([[], ["read"], ["INBOUND"]])("denies insufficient scopes %j", async (...scopes) => {
    vi.mocked(verifyInboundApiKey).mockResolvedValue({ ...key, scopes: scopes.flat() });
    expect(await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" })).toHaveProperty("status", 403);
  });
  it("denies a different tenant", async () => {
    expect(await requireInboundApiAuth(request({ "x-api-key": secret, "x-tenant-id": "tenant-b" }), { kind: "search" })).toHaveProperty("status", 403);
    expect(touchApiKeyLastUsed).not.toHaveBeenCalled();
  });
  it("limits requests before performing credential lookups", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(NextResponse.json({}, { status: 429, headers: { "Retry-After": "17" } }));
    const result = await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" });
    expect(result).toHaveProperty("status", 429);
    expect((result as NextResponse).headers.get("Retry-After")).toBe("17");
    expect(verifyInboundApiKey).not.toHaveBeenCalled();
  });
  it("keeps per-key write and search limits", async () => {
    await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" });
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ namespace: "inbound-api.write", key: key.id, limit: 60 }));
  });
  it("enforces the per-key quota after authentication", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(null).mockResolvedValueOnce(NextResponse.json({}, { status: 429, headers: { "Retry-After": "12" } }));
    const result = await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "search" }) as NextResponse;
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("12");
    expect(touchApiKeyLastUsed).not.toHaveBeenCalled();
  });
  it.each([0, 1])("fails closed when limiter stage %s is unavailable", async (stage) => {
    if (stage === 1) vi.mocked(enforceRateLimit).mockResolvedValueOnce(null);
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(NextResponse.json({}, { status: 503 }));
    expect(await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" })).toHaveProperty("status", 503);
    expect(touchApiKeyLastUsed).not.toHaveBeenCalled();
  });
  it("does not put credentials in audit metadata", async () => {
    vi.mocked(verifyInboundApiKey).mockResolvedValue(null);
    await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "search" });
    const audit = vi.mocked(writeActivityLog).mock.calls[0][0];
    expect(JSON.stringify(audit.metadata)).not.toContain(secret);
  });
  it("fails closed without exposing database errors", async () => {
    vi.mocked(verifyInboundApiKey).mockRejectedValue(new Error("private database details"));
    const result = await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" }) as NextResponse;
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("private database details");
  });
  it("fails closed when service configuration is missing", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue(null);
    expect(await requireInboundApiAuth(request({ "x-api-key": secret }), { kind: "write" })).toHaveProperty("status", 500);
  });
});
