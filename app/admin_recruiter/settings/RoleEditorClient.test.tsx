// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoleEditorClient from "./RoleEditorClient";
const mocks = vi.hoisted(() => ({ router: { replace: vi.fn(), push: vi.fn() }, fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({
  useModulePermission: () => ({ canEdit: true, canDelete: true, canView: true, loading: false }),
  useInvalidateStaffModuleAccess: () => vi.fn(), writeStaffAccessCache: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ roles: [], resources: [] }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
function mount() { return render(<QueryClientProvider client={new QueryClient()}><RoleEditorClient mode="create" /></QueryClientProvider>); }
describe("role name validation", () => {
  it("enables a module with view-only access and requires explicit edit/delete grants", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ roles: [], resources: [{ key: "hiring", label: "Hiring", description: "Hiring access", kind: "module" }] }) });
    mount();
    const toggle = await screen.findByRole("switch", { name: "Enable Hiring" });
    fireEvent.click(toggle);
    expect(screen.getByRole("checkbox", { name: "View" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Edit" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Delete" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Edit" }));
    expect(screen.getByRole("checkbox", { name: "Edit" })).toBeChecked();
    fireEvent.click(toggle);
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    fireEvent.click(toggle);
    expect(screen.getByRole("checkbox", { name: "Edit" })).not.toBeChecked();
  });

  it("shows an inline error for an empty or whitespace-only name", async () => {
    mount();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText("Marketing Manager"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Role name is required.");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("displays the server-aligned 80-character limit and guards overlong values", async () => {
    mount();
    const input = screen.getByPlaceholderText("Marketing Manager");
    await waitFor(() => expect(input).toBeEnabled());
    expect(input).toHaveAttribute("maxlength", "80");
    fireEvent.change(input, { target: { value: "x".repeat(81) } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("80 characters or fewer");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("built-in role labels", () => {
  it("identifies a system role without calling it custom", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ roles: [{ roleKey: "recruiter", label: "Recruiter", isSystem: true, isAdmin: false, permissions: [] }], resources: [] }) });
    render(<QueryClientProvider client={new QueryClient()}><RoleEditorClient mode="edit" roleKey="recruiter" /></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Edit Built-in Role" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit Custom Role" })).not.toBeInTheDocument();
  });
});
