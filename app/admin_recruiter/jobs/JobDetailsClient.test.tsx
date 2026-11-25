// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobDetailsClient from "./JobDetailsClient";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn(), detail: vi.fn(), edit: true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({}) }));
vi.mock("@/lib/tenant/tenant-branding", () => ({ brandingToCssVars: () => ({}) }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useStaffModuleAccess: () => ({ canEdit: () => mocks.edit }) }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ fetchStaffDetailJson: mocks.detail, invalidateStaffDetailCache: vi.fn(), jobDetailsApiUrl: (id: string) => `/api/admin/jobs/${id}` }));
vi.mock("@/app/components/BrandedSvgIcon", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/applications/AddCandidateModal", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/applications/ImportCandidatesModal", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/candidates/AssignRecruiterModal", () => ({ AssignRecruiterModal: () => null }));
vi.mock("./JobTagsModal", () => ({ JobTagsModal: () => null }));
beforeEach(() => { vi.clearAllMocks(); mocks.edit = true; mocks.detail.mockResolvedValue({ ok: true, payload: { job: { id: "job-a", public_title: "Archived role", status: "archived", tags: [] } } }); mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ deletedIds: ["job-a"] }) }); vi.stubGlobal("fetch", mocks.fetch); });
async function confirmDelete() {
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete job" }));
  expect(mocks.fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: /Type DELETE to confirm/ }), { target: { value: "DELETE" } });
  fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
}
describe("archived job details deletion", () => {
  it("deletes only the selected job after confirmation and returns to the list", async () => {
    render(<JobDetailsClient jobId="job-a" />);
    await screen.findByRole("heading", { name: "Archived role", exact: true });
    await confirmDelete();
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin_recruiter/jobs"));
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/jobs", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ ids: ["job-a"] }) }));
  });
  it("keeps failed deletions visible and hides Delete for read-only staff", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Deletion failed" }) });
    const { unmount } = render(<JobDetailsClient jobId="job-a" />);
    await screen.findByRole("heading", { name: "Archived role", exact: true });
    await confirmDelete();
    expect(await screen.findByText("Deletion failed")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    unmount(); mocks.edit = false;
    render(<JobDetailsClient jobId="job-a" />);
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Delete job" })).not.toBeInTheDocument();
  });
});

describe("candidate actions require an open job", () => {
  it.each(["closed", "draft", "paused"])("blocks resume uploads and matching on %s jobs", async (status) => {
    mocks.detail.mockResolvedValue({ ok: true, payload: { job: { id: "job-a", public_title: "QA role", status, tags: [] } } });
    render(<JobDetailsClient jobId="job-a" />);
    expect(await screen.findByRole("button", { name: "Upload Resumes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Match Candidates" })).toBeDisabled();
  });
});
