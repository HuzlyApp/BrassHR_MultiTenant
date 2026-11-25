/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCandidateEmailTemplates } from "./useCandidateEmailTemplates";
vi.mock("@/lib/staff-auth-headers", () => ({ staffAuthHeaders: async () => ({ Authorization: "Bearer test-token" }) }));
afterEach(() => vi.unstubAllGlobals());

describe("mail template loading", () => {
  it("uses the shared bounded token helper and preserves bearer authentication", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ templates: [{ template_key: "welcome", name: "Welcome" }] }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useCandidateEmailTemplates(null));
    await waitFor(() => expect(result.current.loadingTemplates).toBe(false));
    expect(result.current.templates).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/admin/email-templates", expect.objectContaining({ credentials: "include", headers: { Authorization: "Bearer test-token" } }));
  });
  it("exits loading with a recoverable error on API failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Try again" }, { status: 503 })));
    const { result } = renderHook(() => useCandidateEmailTemplates(null));
    await waitFor(() => expect(result.current.loadingTemplates).toBe(false));
    expect(result.current.templatesError).toBe("Try again");
  });
});
