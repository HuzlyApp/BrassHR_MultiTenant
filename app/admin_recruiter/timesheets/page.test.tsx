// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TimesheetsPage from "./page";
const mocks = vi.hoisted(() => ({ canEdit: true, success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => ({ canEdit: mocks.canEdit }) }));
vi.mock("@/lib/staff-auth-headers", () => ({ staffFetchInit: async (headers = {}) => ({ credentials: "include", headers }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success, error: mocks.error } }));
vi.mock("@/app/admin_recruiter/components/DashboardPageLoader", () => ({ default: () => <div>Loading timesheets</div> }));
const sheetId = "10000000-0000-4000-8000-000000000001";
const row = {
  id: "employee-1", workerId: "employee-1", timesheetId: sheetId, approvalStatus: "submitted",
  name: "Staging Worker", jobRole: "RN", facility: "Clinic", department: "Nursing",
  dailyHours: { mon: "8h", tue: "—", wed: "—", thu: "—", fri: "—", sat: "—", sun: "—" },
  totalHours: "8h", otHours: "0h", status: "Complete", daysWorked: 1, daysDetails: [],
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function setup(overrides = {}, approve: () => Promise<Response> = async () => response({ id: sheetId, status: "approved" })) {
  let approved = false;
  const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === "POST") {
      const res = await approve();
      if (res.ok) approved = true;
      return res;
    }
    return response({ timesheets: [{ ...row, ...overrides, approvalStatus: approved ? "approved" : (overrides as { approvalStatus?: string }).approvalStatus ?? row.approvalStatus }], total: 1, totalPages: 1 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<TimesheetsPage />);
  return fetcher;
}
async function openApproval(location: "menu" | "drawer") {
  await screen.findAllByText("Staging Worker");
  if (location === "menu") {
    fireEvent.click(screen.getByRole("button", { name: "Actions for Staging Worker" }));
    return screen.getByRole("button", { name: "Approve Timesheet" });
  }
  fireEvent.click(screen.getAllByText("Staging Worker")[0]);
  return within(screen.getByRole("dialog")).getByRole("button", { name: "Approve Timesheet" });
}
beforeEach(() => { vi.clearAllMocks(); mocks.canEdit = true; });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("timesheet approval buttons", () => {
  it.each(["admin", "recruiter"])("%s saves the weekly sheet through the existing API and sees persisted status after refresh", async () => {
    const fetcher = setup();
    fireEvent.click(await openApproval("menu"));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Timesheet for Staging Worker approved."));
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/timesheets/${sheetId}/approve`, expect.objectContaining({ method: "POST", body: "{}", credentials: "include" }));
    await waitFor(() => expect(screen.getAllByText("approved").length).toBeGreaterThan(0));
    expect(fetcher.mock.calls.filter(([,init]) => init?.method !== "POST")).toHaveLength(2);
  });
  it("connects drawer approval and prevents duplicate clicks while saving", async () => {
    let finish!: (res: Response) => void;
    const fetcher = setup({}, () => new Promise(resolve => { finish = resolve; }));
    const button = await openApproval("drawer");
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetcher.mock.calls.filter(([,init]) => init?.method === "POST")).toHaveLength(1));
    expect(button).toBeDisabled();
    expect(mocks.success).not.toHaveBeenCalled();
    finish(response({ id: sheetId, status: "approved" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it.each(["draft", "rejected", "approved"])("does not approve a %s sheet", async (approvalStatus) => {
    const fetcher = setup({ approvalStatus });
    const button = approvalStatus === "approved"
      ? (await screen.findAllByText("Staging Worker"), fireEvent.click(screen.getByRole("button", { name: "Actions for Staging Worker" })), screen.getByRole("button", { name: "Approved" }))
      : await openApproval("menu");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetcher.mock.calls.some(([,init]) => init?.method === "POST")).toBe(false);
  });
  it("disables approval without a period sheet", async () => {
    setup({ timesheetId: null });
    expect(await openApproval("drawer")).toBeDisabled();
  });
  it.each(["admin", "recruiter"])("disables %s approval when Scheduling edit is denied", async () => {
    mocks.canEdit = false;
    const fetcher = setup();
    const button = await openApproval("menu");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetcher.mock.calls.some(([,init]) => init?.method === "POST")).toBe(false);
  });
  it.each([
    [403, "Another authorized reviewer is required"],
    [409, "Timesheet is no longer submitted"],
    [500, "Service unavailable"],
  ])("shows API error %s without claiming success or closing the drawer", async (status, error) => {
    setup({}, async () => response({ error }, status));
    fireEvent.click(await openApproval("drawer"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(error));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve Timesheet" })).toBeEnabled();
  });
  it("rejects an unconfirmed HTTP success response", async () => {
    setup({}, async () => response({ status: "submitted" }));
    fireEvent.click(await openApproval("menu"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Approval was not confirmed. Refresh and try again."));
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("uses the Eastern Monday–Sunday period even when the user's local date is Monday", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T02:00:00Z"));
    const fetcher = setup();
    await screen.findAllByText("Staging Worker");
    const url = new URL(String(fetcher.mock.calls[0][0]), "https://staging.example");
    expect(url.searchParams.get("start")).toBe("2026-11-09");
    expect(url.searchParams.get("end")).toBe("2026-11-15");
  });
});

