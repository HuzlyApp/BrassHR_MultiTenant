// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfessionDocumentsPanel from "./ProfessionDocumentsPanel";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), params: new URLSearchParams(), router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/admin_recruiter/settings/profession", useSearchParams: () => mocks.params }));
let description = "Stored description";
beforeEach(() => {
  description = "Stored description";
  mocks.fetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") description = JSON.parse(String(init.body)).description;
    return { ok: true, json: async () => url.includes("profession-documents") ? { canManage: true, industryKey: "other", industries: [{ key: "other", label: "Other", description, iconId: "code" }], professions: [], availableProfessions: [] } : { ok: true, settings: {}, professions: [] } };
  });
  vi.stubGlobal("fetch", mocks.fetch); vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
});
describe("industry metadata persistence", () => {
  it("loads stored descriptions, saves edits, and restores them after remount", async () => {
    const view = render(<ProfessionDocumentsPanel />);
    await screen.findAllByText("Stored description");
    fireEvent.click(screen.getByRole("button", { name: "Industry actions for Other" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit industry" }));
    fireEvent.change(screen.getByLabelText(/Description \(Optional\)/), { target: { value: "Edited description" } });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/tenant-industries", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"description":"Edited description"') })));
    await screen.findAllByText("Edited description");
    view.unmount();
    render(<ProfessionDocumentsPanel />);
    expect((await screen.findAllByText("Edited description")).length).toBeGreaterThan(0);
  });
  it("does not delete an industry when confirmation is cancelled", async () => {
    render(<ProfessionDocumentsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Industry actions for Other" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete industry" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
});
