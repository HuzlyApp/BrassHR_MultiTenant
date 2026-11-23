// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ fetchStaffDetailJson: mocks.detail, invalidateStaffDetailCache: vi.fn() }));
import { StageStatusSequenceButtons } from "./StageStatusSequenceButtons";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("custom stage status action", () => {
  it("preselects and applies the status named by the button rather than the first alternate", async () => {
    mocks.detail.mockImplementation(async (url: string) => ({ ok: true, payload: url.includes("stage-assignments") ? {
      buttonLabels: { alternateLabel: "Follow Up needed test" },
      assignments: [],
      lanes: [
        { stageName: "Intake", statusId: "process", lane: "alternate", sortOrder: 0 },
        { stageName: "Intake", statusId: "follow", lane: "alternate", sortOrder: 1 },
      ],
      reasonCodes: [{ stageName: "Intake", code: "Call later", lane: "alternate" }], notes: [],
    } : { statuses: [{ id: "process", name: "Process Application" }, { id: "follow", name: "Follow Up needed test" }] } }));
    const request = vi.fn(async (_url: unknown, init?: RequestInit) => Response.json(init?.method === "PATCH"
      ? { application: { statusId: "follow", statusName: "Follow Up needed test" } }
      : { note: { body: "Requested callback" }, notes: [] }));
    vi.stubGlobal("fetch", request);
    const changed = vi.fn();
    render(<StageStatusSequenceButtons applicationId="application-a" stageName="Intake" knownApplication={{ status_id: "new" }} onStatusChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Follow Up needed test" }));
    expect(screen.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("follow");
    fireEvent.change(screen.getByRole("combobox", { name: "Reason code" }), { target: { value: "Call later" } });
    fireEvent.change(screen.getByPlaceholderText("Search notes for this stage"), { target: { value: "Requested callback" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith({ statusId: "follow", statusName: "Follow Up needed test" }));
    expect(request).toHaveBeenCalledWith("/api/admin/job-applications/application-a/status", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"statusId":"follow"') }));
  });
});
