// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { dispatchCandidatePipelineRefresh } from "@/lib/admin/candidate-pipeline-events";
const workerId = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({ load: vi.fn(), invalidate: vi.fn(), pathname: "/admin_recruiter/new/profile/11111111-1111-4111-8111-111111111111" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ fetchStaffDetailJson: mocks.load, invalidateStaffDetailCache: mocks.invalidate, workerProfileApiUrl: (id: string) => `/api/admin/worker-profile?workerId=${id}` }));
vi.mock("./DetailedCandidateHeader", () => ({ default: ({ statusLabel, phone, progressUpcoming }: { statusLabel: string; phone: string; progressUpcoming: number }) => <div>{statusLabel}<span>{phone}</span><span data-testid="upcoming">{progressUpcoming}</span></div> }));
vi.mock("./DetailedTabs", () => ({ default: () => null }));
vi.mock("./CandidateCommunicationDialog", () => ({ default: () => null }));
import CandidateDetailChrome from "./CandidateDetailChrome";
afterEach(cleanup);
describe("persistent candidate header", () => {
  it("counts the same 25 pre-hire steps on Profile and Pre-hire instead of mixing in 19 post-hire steps", async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, payload: { worker: { first_name: "QA" }, onboardingSteps: [
      ...Array.from({ length: 25 }, (_, i) => ({ id: `pre-${i}`, phase: "pre_hire", state: "pending" })),
      ...Array.from({ length: 19 }, (_, i) => ({ id: `post-${i}`, phase: "post_hire", state: "pending" })),
    ] } });
    const view = render(<CandidateDetailChrome>Profile</CandidateDetailChrome>);
    await waitFor(() => expect(screen.getByTestId("upcoming")).toHaveTextContent("25"));
    mocks.pathname = `/admin_recruiter/new/pre-hire/${workerId}`;
    view.rerender(<CandidateDetailChrome>Pre-hire</CandidateDetailChrome>);
    expect(screen.getByTestId("upcoming")).toHaveTextContent("25");
    mocks.pathname = `/admin_recruiter/new/post-hire/${workerId}`;
    view.rerender(<CandidateDetailChrome>Post-hire</CandidateDetailChrome>);
    expect(screen.getByTestId("upcoming")).toHaveTextContent("19");
    mocks.pathname = `/admin_recruiter/new/profile/${workerId}`;
  });

  it("refreshes status and formatted phone after a candidate mutation event", async () => {
    mocks.load.mockResolvedValueOnce({ ok: true, payload: { worker: { first_name: "Ana", status_label: "In Process", phone: "9195550100" } } });
    render(<CandidateDetailChrome>Profile</CandidateDetailChrome>);
    await screen.findByText("In Process");
    mocks.load.mockResolvedValueOnce({ ok: true, payload: { worker: { first_name: "Ana", status_label: "Closed Application", phone: "9195550199" } } });
    act(() => dispatchCandidatePipelineRefresh(workerId));
    await screen.findByText("Closed Application");
    expect(screen.getByText("(919) 555-0199")).toBeInTheDocument();
    await waitFor(() => expect(mocks.load).toHaveBeenLastCalledWith(`/api/admin/worker-profile?workerId=${workerId}`, { bust: true }));
  });
});
