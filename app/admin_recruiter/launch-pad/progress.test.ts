// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLaunchPadProgress, isLaunchPadFullyComplete, LAUNCH_PAD_PROGRESS_EVENT, syncLaunchPadProgress, writeLaunchPadProgress } from "./progress";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("server-confirmed Launch Pad completion", () => {
  it("replaces old browser completion with server progress and updates sidebar listeners", async () => {
    const complete = { logo: true, branding: true, domain: true, preview: true, invite: true, organization: true };
    writeLaunchPadProgress("tenant-a", complete);
    const listener = vi.fn();
    window.addEventListener(LAUNCH_PAD_PROGRESS_EVENT, listener);
    try {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ tenantId: "tenant-a", progress: emptyLaunchPadProgress() })));
      await syncLaunchPadProgress("tenant-a");
      expect(isLaunchPadFullyComplete("tenant-a")).toBe(false);
      expect(listener).toHaveBeenCalledOnce();
      vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tenantId: "tenant-a", progress: complete }));
      await syncLaunchPadProgress("tenant-a", "organization");
      expect(isLaunchPadFullyComplete("tenant-a")).toBe(true);
      expect(isLaunchPadFullyComplete("tenant-b")).toBe(false);
    } finally {
      window.removeEventListener(LAUNCH_PAD_PROGRESS_EVENT, listener);
    }
  });
  it("rejects responses scoped to a different tenant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ tenantId: "tenant-b", progress: emptyLaunchPadProgress() })));
    await expect(syncLaunchPadProgress("tenant-a")).rejects.toThrow();
    expect(localStorage.length).toBe(0);
  });
});
