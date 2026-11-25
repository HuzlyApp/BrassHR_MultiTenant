// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Control from "./UpdateAssignedWorkflowControl";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ invalidateStaffDetailCache: vi.fn() }));
vi.mock("@/lib/admin/candidate-pipeline-events", () => ({ dispatchCandidatePipelineRefresh: vi.fn() }));
vi.mock("./CandidateWorkflowReassignConfirmModal", () => ({ CandidateWorkflowReassignConfirmModal: ({ open, onYes, onNo }: { open: boolean; onYes: () => void; onNo: () => void }) => open ? <div role="dialog"><button onClick={onYes}>Confirm workflow</button><button onClick={onNo}>Cancel workflow</button></div> : null }));
beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === "POST" ? { ok: true, workflowName: "Contractor flow" } : {
    applicationId: "application-a", currentWorkflowId: "w2-flow", currentWorkflowName: "Employee flow",
    workflows: [{ id: "w2-flow", name: "Employee flow", employmentType: "W2" }, { id: "1099-flow", name: "Contractor flow", employmentType: "1099" }],
  } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("per-hire workflow type selection", () => {
  it("labels W2 and 1099 choices and changes only the selected candidate application after confirmation", async () => {
    render(<Control workerId="candidate-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Update assigned workflow" }));
    expect(await screen.findByText("Payroll type: W2")).toBeInTheDocument();
    expect(screen.getByText(/This application keeps its assigned workflow when the job changes/)).toBeInTheDocument();
    expect(screen.getByText("Assigned to this application")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Contractor flow.*1099/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirm workflow" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/candidates/candidate-a/reassign-workflow", expect.objectContaining({ method: "POST", body: JSON.stringify({ workflowId: "1099-flow", applicationId: "application-a" }) })));
  });
});
