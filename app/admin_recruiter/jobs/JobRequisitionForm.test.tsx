// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultJobFormUiState } from "./job-form-shared";
import { writeJobRequisitionFormDraft } from "@/lib/jobs/job-requisition-form-draft";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), success: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success } }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useStaffModuleAccess: () => ({ canEdit: () => true, loading: false }) }));
vi.mock("./JobFormStepSetup", () => ({ JobFormStepSetup: () => <div>Job setup</div> }));
vi.mock("./JobPostPreviewModal", () => ({ JobPostPreviewModal: () => null }));
vi.mock("./JobReviewEditModal", () => ({ JobReviewEditModal: () => null }));
vi.mock("./WorkflowChangeConfirmModal", () => ({ WorkflowChangeConfirmModal: () => null }));
vi.mock("./JobFormSteps", () => ({
  JobFormFooter: (props: { onSaveDraft: () => void; saving: boolean }) => <button disabled={props.saving} onClick={props.onSaveDraft}>Save draft</button>,
  JobFormStepCompensation: () => null, JobFormStepDescription: () => null,
  JobFormStepMspDetails: () => null, JobFormStepRequisition: () => null,
  JobFormStepReview: () => <div>Job review</div>, JobFormWorkflowBanner: () => null,
}));
import JobRequisitionForm from "./JobRequisitionForm";

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState(null, "", "/admin_recruiter/jobs/new");
  mocks.fetch.mockImplementation(async (_url: string, init?: RequestInit) => Response.json(init?.method === "POST" ? { job: { id: "saved-job", updated_at: "2026-11-26T00:00:00Z" } } : { professions: [], specialties: [] }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

function reviewDraft() {
  window.history.replaceState(null, "", "/admin_recruiter/jobs/new?step=review");
  writeJobRequisitionFormDraft({
    jobId: null, step: "review", job: { sourceType: "Internal", publicTitle: "IT Support", publicDescription: "Support our team", professionId: "it", employmentType: "W2", location: "Charlotte, NC" },
    ui: defaultJobFormUiState(), mspSourcedByClient: false, mspPlacementType: null,
    referenceJobId: null, assignmentMode: "automatic", overrideWorkflowId: null,
    termsAccepted: false, screeningQuestions: [], confirmRoutingChange: false,
  });
}

it("renders new-job setup while reference requests are pending", async () => {
  mocks.fetch.mockImplementation(() => new Promise(() => {}));
  render(<JobRequisitionForm />);
  expect(screen.getByText("Job setup")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
});

it("saves a restored draft, reports success, clears the draft and opens Jobs", async () => {
  reviewDraft(); render(<JobRequisitionForm />);
  await screen.findByText("Job review");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Job draft saved successfully."));
  expect(mocks.push).toHaveBeenCalledWith("/admin_recruiter/jobs");
  expect(sessionStorage.getItem("braasJobRequisitionFormInProgress")).toBeNull();
  expect(mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("shows server failure feedback and keeps the restored draft for recovery", async () => {
  mocks.fetch.mockImplementation(async (_url: string, init?: RequestInit) => Response.json(init?.method === "POST" ? { error: "Could not save this job" } : { professions: [], specialties: [] }, { status: init?.method === "POST" ? 503 : 200 }));
  reviewDraft(); render(<JobRequisitionForm />);
  await screen.findByText("Job review");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByText("Could not save this job")).toBeInTheDocument();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("braasJobRequisitionFormInProgress")).not.toBeNull();
});

it("shows a recoverable options error instead of crashing the wizard on incomplete data", async () => {
  mocks.fetch.mockResolvedValue(Response.json({}));
  render(<JobRequisitionForm />);
  expect(await screen.findByText("Job options are incomplete. Please reload this page and try again.")).toBeInTheDocument();
  expect(screen.getByText("Job setup")).toBeInTheDocument();
});
