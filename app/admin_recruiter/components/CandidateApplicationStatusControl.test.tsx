// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CandidateApplicationStatusControl } from "./CandidateApplicationStatusControl";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), applicationId: "application-a", ambiguous: false }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
beforeEach(() => {
  mocks.applicationId = "application-a"; mocks.ambiguous = false;
  mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => ({ ok: true, json: async () => {
    if (init?.method === "PATCH") return { application: { statusId: "custom-status", statusName: "Custom Reopened" } };
    if (url.includes("application-statuses?")) return { statuses: [{ id: "closed-status", name: "Closed Application", systemKey: "archived" }, { id: "custom-status", name: "Custom Reopened", systemKey: null }] };
    return { applicationId: mocks.applicationId || null, ambiguous: mocks.ambiguous, status: { id: "closed-status", name: "Closed Application" } };
  } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("candidate reactivation and custom statuses", () => {
  it("opens the status dialog from Reactivate and applies an active custom status after confirmation", async () => {
    const changed = vi.fn();
    render(<CandidateApplicationStatusControl workerId="candidate-a" fallbackStatus="Closed Application" actionLabel="Reactivate" onStatusChanged={changed} />);
    const button = screen.getByRole("button", { name: "Reactivate" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Custom Reopened" }));
    expect(screen.getByRole("dialog", { name: "Change Status" })).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith({ statusName: "Custom Reopened", statusId: "custom-status" }));
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/job-applications/application-a/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ statusId: "custom-status" }) }));
  });
  it.each(["missing", "ambiguous"])("explains %s application context instead of offering a dead reactivation action", async (kind) => {
    mocks.applicationId = kind === "missing" ? "" : "application-a";
    mocks.ambiguous = kind === "ambiguous";
    render(<CandidateApplicationStatusControl workerId="candidate-a" actionLabel="Reactivate" />);
    expect(await screen.findByText(/Open Applications and select an application/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivate" })).toBeDisabled();
  });
});
