// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TimeOffRequestsPage from "./page";
const permissions = vi.hoisted(() => ({ canEdit: true }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => permissions }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); permissions.canEdit = true; });
const request = { id: "request-a", start_date: "2026-11-27", end_date: "2026-11-28", reason: "Family event", off_type: "Vacation", status: "pending", worker: { first_name: "Ana", last_name: "Cruz" } };
describe("time-off approval page", () => {
  it.each(["Approve", "Reject"])("reviews a pending request using %s", async (decision) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ requests: [request], total: 1 }))
      .mockResolvedValueOnce(Response.json({ status: decision === "Approve" ? "approved" : "rejected" }))
      .mockResolvedValueOnce(Response.json({ requests: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TimeOffRequestsPage />);
    await screen.findByText("Ana Cruz");
    fireEvent.click(screen.getByRole("button", { name: decision, exact: true }));
    await screen.findByText("No pending time-off requests.");
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/worker-requests/request-a/${decision.toLowerCase()}`, expect.objectContaining({ method: "POST" }));
  });
  it("keeps a failed review visible with a retryable error", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ requests: [request], total: 1 }))
      .mockResolvedValueOnce(Response.json({ error: "Another authorized reviewer is required" }, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TimeOffRequestsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Another authorized reviewer is required");
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());
  });
  it("shows no approval controls for a read-only viewer", async () => {
    permissions.canEdit = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ requests: [request], total: 1 })));
    render(<TimeOffRequestsPage />);
    await screen.findByText("Ana Cruz");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
