// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ clientId: "client-a" }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => ({ canEdit: true }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success } }));
import ClientDetailPage from "./page";
beforeEach(() => {
  mocks.success.mockReset();
  mocks.fetch.mockReset().mockImplementation(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => ({ client: { id: "client-a", company_name: "Clinic A", archived_at: init?.method === "PATCH" ? "2026-11-28" : null }, facilities: [] }) }));
  vi.stubGlobal("fetch", mocks.fetch);
  window.confirm = vi.fn(() => true);
});
describe("client update feedback", () => {
  it.each(["   ", "<b>Clinic</b>"])("shows an error and prevents saving invalid name %s", async name => {
    render(<ClientDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit client" }));
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: name } });
    fireEvent.submit(screen.getByRole("button", { name: "Save client" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Company name");
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("confirms archive success after the mutation succeeds", async () => {
    render(<ClientDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Archive client" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Client archived."));
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/clients/client-a", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "archive", companyName: "Clinic A" }) }));
  });
});
