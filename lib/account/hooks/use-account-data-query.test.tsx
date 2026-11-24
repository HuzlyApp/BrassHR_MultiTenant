// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAccountDataQuery } from "./use-account-data-query";
const mocks = vi.hoisted(() => ({ listeners: new Set<(event: string, session: unknown) => void>(), load: vi.fn() }));
vi.mock("@/lib/account/fetch-account-data", () => ({ fetchAccountData: (...args: unknown[]) => mocks.load(...args) }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
  mocks.listeners.add(listener);
  return { data: { subscription: { unsubscribe: () => mocks.listeners.delete(listener) } } };
} } } }));
describe("account identity cache", () => {
  it("never displays the previous admin profile while HR account details load", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const admin = { user: { id: "admin" }, profile: { role: "admin" } };
    mocks.load.mockResolvedValueOnce(admin);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useAccountDataQuery(), { wrapper });
    act(() => mocks.listeners.forEach(fn => fn("INITIAL_SESSION", { user: { id: "admin" } })));
    await waitFor(() => expect(result.current.profile?.role).toBe("admin"));
    let resolveHr!: (value: unknown) => void;
    mocks.load.mockImplementation(() => new Promise(resolve => { resolveHr = resolve; }));
    act(() => mocks.listeners.forEach(fn => fn("SIGNED_IN", { user: { id: "hr" } })));
    expect(result.current.profile).toBeNull();
    await waitFor(() => expect(resolveHr).toBeDefined());
    await act(async () => resolveHr({ user: { id: "hr" }, profile: { role: "hr" } }));
    await waitFor(() => expect(result.current.profile?.role).toBe("hr"));
    act(() => mocks.listeners.forEach(fn => fn("SIGNED_OUT", null)));
    expect(result.current.user).toBeNull(); expect(result.current.profile).toBeNull();
  });
});
