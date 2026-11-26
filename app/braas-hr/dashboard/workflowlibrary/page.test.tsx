// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkflowLibraryPage } from "./WorkflowLibraryPage";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), refetch: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin_recruiter/dashboard/workflowlibrary", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/staff-auth-headers", () => ({ staffFetchInit: async () => ({}) }));
vi.mock("@/lib/onboarding/hooks/use-onboarding-libraries", () => ({ useOnboardingLibraries: () => ({ tenantId: "tenant-a", libraries: [{ id: "folder-a", name: "QA Folder", slug: "qa", publishedCount: 0, unpublishedCount: 0 }, { id: "default", name: "Default", slug: "onboarding", publishedCount: 0, unpublishedCount: 0 }], refetch: mocks.refetch }) }));
vi.mock("@/lib/onboarding/hooks/use-onboarding-flows", () => ({ useOnboardingFlows: () => ({ flows: [] }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); vi.stubGlobal("fetch", mocks.fetch); vi.stubGlobal("confirm", vi.fn().mockReturnValue(false)); });
describe("workflow library controls", () => {
  it("renames custom folders and refreshes the list", async () => {
    render(<WorkflowLibraryPage />);
    expect(screen.queryByRole("button", { name: "Rename Default" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rename QA Folder" }));
    fireEvent.change(screen.getByLabelText("Folder name for QA Folder"), { target: { value: "Renamed Folder" } });
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/onboarding-libraries/folder-a", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed Folder" }) })));
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalled());
  });
  it("requires confirmation before deleting a folder", async () => {
    render(<WorkflowLibraryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Delete QA Folder" }));
    expect(mocks.fetch).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete QA Folder" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/onboarding-libraries/folder-a", expect.objectContaining({ method: "DELETE" })));
  });
});
