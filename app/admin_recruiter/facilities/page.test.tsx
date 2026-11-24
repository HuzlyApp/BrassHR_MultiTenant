// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Page from "./page";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), editable: true, archived: false }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => ({ canEdit: mocks.editable }) }));
vi.mock("@/app/admin_recruiter/components/CreateFacilityModal", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/components/AssignCandidateToFacilityModal", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/components/CandidatesListShell", () => ({ CandidatesViewToggle: () => null }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const facility = { id: "11111111-1111-4111-8111-111111111111", name: "Facility One", address: "123 Main Street", phone: "9195550100", createdAt: "2026-11-01", assignedCount: 0 };
beforeEach(() => {
  mocks.editable = true; mocks.archived = false;
  mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      if (body.action === "archive") mocks.archived = true;
      if (body.action === "restore") mocks.archived = false;
      return { ok: true, json: async () => ({ facility }) };
    }
    return { ok: true, json: async () => url.includes("/assignments") ? { workers: [] } : { facilities: url.includes("archived=1") === mocks.archived ? [facility] : [] } };
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("confirm", vi.fn(() => true));
});
async function selectFacility() { fireEvent.click((await screen.findByText("Facility One")).closest("button")!); }
describe("facility management actions", () => {
  it("saves a rename and phone edit through the scoped facility endpoint", async () => {
    render(<Page />); await selectFacility();
    fireEvent.click(screen.getByRole("button", { name: "Edit facility" }));
    fireEvent.change(screen.getByLabelText("Facility name"), { target: { value: "Renamed Facility" } });
    fireEvent.click(screen.getByRole("button", { name: "Save facility" }));
    await screen.findByRole("button", { name: "Edit facility" });
    expect(mocks.fetch).toHaveBeenCalledWith(`/api/admin/facilities/${facility.id}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "edit", name: "Renamed Facility", phone: facility.phone }) }));
  });
  it("supports archive and restore while withholding new assignments in the archive view", async () => {
    render(<Page />); await selectFacility();
    fireEvent.click(screen.getByRole("button", { name: "Archive facility" }));
    await screen.findByRole("button", { name: "Show archived facilities" });
    fireEvent.click(screen.getByRole("button", { name: "Show archived facilities" }));
    await selectFacility();
    expect(screen.queryByRole("button", { name: "Assign Worker" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore facility" }));
    expect(mocks.fetch).toHaveBeenCalledWith(`/api/admin/facilities/${facility.id}`, expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"restore"') }));
  });
  it("keeps edit and archive actions hidden from read-only staff", async () => {
    mocks.editable = false;
    render(<Page />); await selectFacility();
    expect(screen.queryByRole("button", { name: "Edit facility" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive facility" })).not.toBeInTheDocument();
  });
});
