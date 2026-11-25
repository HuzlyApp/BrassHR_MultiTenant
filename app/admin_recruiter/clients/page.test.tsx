// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClientsPage from "./page";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/app/admin_recruiter/components/DashboardPageLoader", () => ({ default: () => null }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  return query;
} } }));
beforeEach(() => { mocks.fetch.mockReset().mockImplementation(async (_url: unknown, options?: RequestInit) => ({ ok: options?.method !== "POST", json: async () => options?.method === "POST" ? { error: "Could not register this organization." } : { clients: [], total: 0 } })); vi.stubGlobal("fetch", mocks.fetch); });
describe("client organization form", () => {
  it("shows a named dialog and rejects an empty company name inline", async () => {
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Client" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Add Client" }));
    expect(screen.getByRole("dialog", { name: "Add Client Organization" })).toBeInTheDocument();
    expect(screen.getByLabelText("Company Name")).toHaveAttribute("maxlength", "120");
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Company name is required.");
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });
  it("keeps create failures visible in the dialog", async () => {
    render(<ClientsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Client" }));
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Test organization" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Client" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not register this organization.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

it.each(["A", "<script>x</script> Client"])("rejects %s before sending a create request", async (name) => {
  render(<ClientsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Add Client" }));
  fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Create Client" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
});
