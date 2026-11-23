// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), detail: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => mocks.params }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ fetchStaffDetailJson: mocks.detail, workerProfileApiUrl: (id: string) => `/api/admin/worker-profile?workerId=${id}` }));
vi.mock("@/app/admin_recruiter/candidates/[workerId]/hire-journey/HireJourneyClient", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/components/AddWorkerSkillModal", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/components/CandidateCommunicationDialog", () => ({ default: () => null }));
vi.mock("./WorkerProfileFilesPanel", () => ({ WorkerProfileFilesPanel: () => null }));
vi.mock("./WorkerProfileSkillAssessmentPanel", () => ({ WorkerProfileSkillAssessmentPanel: () => null }));
import { AdminWorkerProfileClient } from "./AdminWorkerProfileClient";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.params.delete("tab"); });
function setup() {
  mocks.detail.mockResolvedValue({ ok: true, payload: { worker: { id: "candidate-a", first_name: "Ana", last_name: "Cruz", status: "active", status_label: "Active" } } });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("employment-workers") ? {
    workers: [{ assignment_start_date: "04/07/2027", assignment_end_date: "10/06/2027", pay_rate: "$58-$60/hr", bill_rate: "$80/hr", facilities: ["Clinic A"] }],
  } : { profile: {}, workSummary: { totalShifts: 4 }, scheduledShifts: [{ id: "shift-a", title: "Nurse shift", workDate: "2026-11-20", startTime: "08:00", endTime: "17:00" }] } })));
  render(<AdminWorkerProfileClient workerId="candidate-a" />);
}
describe("worker profile employment details", () => {
  it("shows the same assignment dates, rates, and workplace as the directory projection", async () => {
    setup();
    expect(await screen.findByText("04/07/2027")).toBeInTheDocument();
    expect(screen.getByText("10/06/2027")).toBeInTheDocument();
    expect(screen.getByText("$58-$60/hr")).toBeInTheDocument();
    expect(screen.getByText("$80/hr")).toBeInTheDocument();
    expect(screen.getByText("Clinic A")).toBeInTheDocument();
  });
  it("shows scheduled shifts in work history", async () => {
    mocks.params.set("tab", "work_history"); setup();
    expect(await screen.findByText("Scheduled shifts")).toBeInTheDocument();
    expect(screen.getByText("Nurse shift")).toBeInTheDocument();
  });
});
