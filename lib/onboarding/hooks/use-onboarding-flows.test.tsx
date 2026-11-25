/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./use-effective-admin-tenant", () => ({ useEffectiveAdminTenantId: () => ({ tenantId: "tenant-a", isLoading: false }) }));
vi.mock("@/lib/staff-auth-headers", () => ({ staffFetchInit: async () => ({}) }));
import { useOnboardingFlows } from "./use-onboarding-flows";
import { useOnboardingLibraries } from "./use-onboarding-libraries";
afterEach(() => vi.unstubAllGlobals());
describe("workflow deletion refresh", () => {
  it("refreshes the folder list and its published count before deletion resolves", async () => {
    let deleted = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") { deleted = true; return Response.json({ ok: true }); }
      return Response.json(url.includes("onboarding-libraries")
        ? { libraries: [{ id: "library-a", publishedCount: deleted ? 0 : 1 }] }
        : { flows: deleted ? [] : [{ id: "flow-a", name: "Flow", status: "published" }], publishedCount: deleted ? 0 : 1 });
    });
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => ({ flows: useOnboardingFlows(), libraries: useOnboardingLibraries() }), { wrapper });
    await waitFor(() => expect(result.current.libraries.libraries[0]?.publishedCount).toBe(1));
    await act(async () => { await result.current.flows.deleteFlow("flow-a"); });
    await waitFor(() => expect(result.current.libraries.libraries[0]?.publishedCount).toBe(0));
    expect(result.current.flows.flows).toEqual([]);
    unmount(); client.clear();
  });
});
