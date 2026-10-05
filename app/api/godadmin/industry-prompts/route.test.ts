import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireGodAdminApiSession = vi.fn();
const createServiceRoleClient = vi.fn();
const listIndustryPrompts = vi.fn();
const getIndustryPromptDetail = vi.fn();
const saveIndustryPromptVersion = vi.fn();
const createIndustryPromptDraft = vi.fn();
const restoreIndustryPromptVersion = vi.fn();
const resolvePromptVersion = vi.fn();

vi.mock("@/lib/auth/require-god-admin-api", () => ({
  requireGodAdminApiSession: (...args: unknown[]) => requireGodAdminApiSession(...args),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

vi.mock("@/lib/godadmin/industry-prompts-service", () => ({
  listIndustryPrompts: (...args: unknown[]) => listIndustryPrompts(...args),
  getIndustryPromptDetail: (...args: unknown[]) => getIndustryPromptDetail(...args),
  saveIndustryPromptVersion: (...args: unknown[]) => saveIndustryPromptVersion(...args),
  createIndustryPromptDraft: (...args: unknown[]) => createIndustryPromptDraft(...args),
  restoreIndustryPromptVersion: (...args: unknown[]) => restoreIndustryPromptVersion(...args),
}));

vi.mock("@/lib/ai-catalog/resolve-prompt", () => ({
  resolvePromptVersion: (...args: unknown[]) => resolvePromptVersion(...args),
}));

vi.mock("@/lib/ai-catalog/errors", () => ({
  PromptNotConfiguredError: class PromptNotConfiguredError extends Error {
    toJSON() {
      return { error: this.message, code: "PROMPT_NOT_CONFIGURED" };
    }
  },
}));

describe("GET/POST /api/godadmin/industry-prompts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServiceRoleClient.mockReturnValue({ mocked: true });
  });

  it("denies non–god-admin GET access", async () => {
    requireGodAdminApiSession.mockResolvedValue(
      NextResponse.json({ error: "Forbidden", detail: "God Admin role required." }, { status: 403 })
    );
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/godadmin/industry-prompts"));
    expect(res.status).toBe(403);
    expect(listIndustryPrompts).not.toHaveBeenCalled();
  });

  it("lists industries for god admin", async () => {
    requireGodAdminApiSession.mockResolvedValue({ userId: "admin-1", godAdmin: true });
    listIndustryPrompts.mockResolvedValue([
      {
        industryKey: "technology",
        label: "Technology / IT Services",
        aiPackKey: "technology",
        configStatus: "partial",
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/godadmin/industry-prompts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.industries).toHaveLength(1);
    expect(body.variants.length).toBeGreaterThan(0);
  });

  it("denies non–god-admin POST save", async () => {
    requireGodAdminApiSession.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/godadmin/industry-prompts", {
        method: "POST",
        body: JSON.stringify({ action: "save" }),
      })
    );
    expect(res.status).toBe(403);
    expect(saveIndustryPromptVersion).not.toHaveBeenCalled();
  });

  it("saves a new published version for god admin", async () => {
    requireGodAdminApiSession.mockResolvedValue({ userId: "admin-1", godAdmin: true });
    saveIndustryPromptVersion.mockResolvedValue({ versionId: "v1", versionNumber: 4 });
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/godadmin/industry-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          industryKey: "technology",
          variantKey: "quick",
          systemPrompt: "Enough system prompt text for validation checks here.",
          userPromptTemplate: "Resume:\n{{candidate_resume}}",
          changeNote: "Tighten technology quick match",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(saveIndustryPromptVersion).toHaveBeenCalledOnce();
    const args = saveIndustryPromptVersion.mock.calls[0][1];
    expect(args.actorUserId).toBe("admin-1");
    expect(args.industryKey).toBe("technology");
  });

  it("restores a prior version without requiring overwrite", async () => {
    requireGodAdminApiSession.mockResolvedValue({ userId: "admin-1", godAdmin: true });
    restoreIndustryPromptVersion.mockResolvedValue({ versionId: "v9", versionNumber: 9 });
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/godadmin/industry-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          industryKey: "technology",
          variantKey: "quick",
          sourceVersionId: "old-version",
          changeNote: "Restored from version 2",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(restoreIndustryPromptVersion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceVersionId: "old-version",
        actorUserId: "admin-1",
      })
    );
  });

  it("resolves the active industry prompt the analyzer uses", async () => {
    requireGodAdminApiSession.mockResolvedValue({ userId: "admin-1", godAdmin: true });
    resolvePromptVersion.mockResolvedValue({
      promptVersionId: "pv-1",
      resolvedVerticalKey: "technology",
      variantKey: "quick",
      versionNumber: 2,
      source: "published_master",
      fallbackApplied: false,
      contentHash: "abc",
    });
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/godadmin/industry-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          industryKey: "technology",
          variantKey: "quick",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.promptVersionId).toBe("pv-1");
    expect(body.resolvedVerticalKey).toBe("technology");
  });
});
