// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkersPage from "./page";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), params: new URLSearchParams(), router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.params }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("@/app/admin_recruiter/components/AdvancedSearchModal", () => ({ default: () => null }));
beforeEach(() => { mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ workers: [{ id: "new-worker", candidate_id: "candidate-a", first_name: "Onboarding", last_name: "Person", status: "new", location: "Carthage, TX" }, { id: "active-worker", candidate_id: "candidate-b", first_name: "Active", last_name: "Person", status: "active", created_at: new Date().toISOString() }] }) }); vi.stubGlobal("fetch", mocks.fetch); });
describe("worker directory states", () => {
  it("opens the existing advanced filters from All Filters", async () => {
    render(<WorkersPage />);
    await screen.findByText("Onboarding Person");
    fireEvent.click(screen.getByTitle("All Filters"));
    expect(await screen.findByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });
  it("uses loading skeletons instead of empty rows and zero cards", () => {
    mocks.fetch.mockImplementation(() => new Promise(() => {}));
    render(<WorkersPage />);
    expect(screen.getByRole("status", { name: "Loading workers" })).toBeInTheDocument();
    expect(screen.getByLabelText("Loading Onboarding Workers")).toBeInTheDocument();
    expect(screen.queryByText("No workers found matching your filters.")).toBeNull();
  });
  it("matches the onboarding card to its status filter", async () => {
    render(<WorkersPage />);
    await screen.findByText("Onboarding Person");
    await waitFor(() => expect(screen.getByText("Onboarding Workers").parentElement).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: /Status • All/ }));
    fireEvent.click(screen.getByRole("button", { name: "Onboarding", exact: true }));
    expect(screen.getByText("Onboarding Person")).toBeInTheDocument();
    expect(screen.queryByText("Active Person")).toBeNull();
  });
});
