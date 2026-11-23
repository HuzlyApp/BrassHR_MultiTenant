// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Page from "./page";
const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), fetch: vi.fn(), push: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
const step = { id: "step-a", step_key: "job_application", step_type: "custom_question", title: "Job application", is_required: true, is_enabled: true, metadata: { workflow_step_id: "parameterized-job-application" } };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => mocks.params }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => ({ slug: "acme" }) }));
vi.mock("@/app/components/onboarding/OnboardingConfigProvider", () => ({ useOnboardingConfigOptional: () => ({ config: { steps: [step] }, updateStepStatus: mocks.update, refresh: mocks.refresh, loading: false }) }));
vi.mock("@/lib/onboarding/use-mark-step-in-progress-if-pending", () => ({ useMarkStepInProgressIfPending: () => {}, persistStepProgress: async (update: (key: string, status: string) => Promise<void>, key: string, status: string) => update(key, status) }));
vi.mock("@/app/components/OnboardingLoader", () => ({ default: () => <p>Loading</p> }));
vi.mock("@/app/components/OnboardingLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/app/components/OnboardingStepper", () => ({ default: () => null }));
vi.mock("@/lib/tenant/tenant-branding", () => ({ brandingToCssVars: () => ({}) }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.params = new URLSearchParams("tenant=acme"); mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ hasQuestions: false, questions: [], jobTitle: "Remote engineer" }) }); vi.stubGlobal("fetch", mocks.fetch); });
describe("job application context and completion", () => {
  it("cannot skip missing application context or claim there are no questions", async () => {
    localStorage.setItem("applicantId", "applicant-a");
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Missing application context");
    expect(screen.queryByRole("button", { name: /Skip for Now/ })).not.toBeInTheDocument();
    expect(screen.queryByText("No screening questions required")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not mark completion or navigate after an unsuccessful backend save", async () => {
    mocks.params.set("job_token", "job-a"); localStorage.setItem("applicantId", "applicant-a");
    mocks.fetch.mockImplementation(async (_url: string, options?: RequestInit) => ({ ok: options?.method !== "POST", json: async () => options?.method === "POST" ? { error: "Could not save" } : { hasQuestions: false, questions: [], jobTitle: "Remote engineer" } }));
    render(<Page />);
    expect(await screen.findByText("Applying for: Remote engineer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("selects a preview job, requires its answers, and submits no live application", async () => {
    mocks.params.set("preview", "draft");
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("/api/public/jobs") ? { jobs: [{ public_job_token: "job-a", public_title: "Remote engineer" }], total: 1 } : { jobTitle: "Remote engineer", hasQuestions: true, questions: [{ id: "question-a", question: "Can you work this schedule?", questionType: "yes_no", isRequired: true }] } }));
    render(<Page />);
    await screen.findByRole("option", { name: "Remote engineer" });
    expect(screen.queryByRole("button", { name: /Skip for Now/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Preview job" }), { target: { value: "job-a" } });
    fireEvent.click(await screen.findByRole("button", { name: "Save & continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer all required questions");
    fireEvent.click(screen.getByRole("radio", { name: "Yes", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save & continue" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.fetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    expect(mocks.fetch.mock.calls.some(([url]) => String(url).includes("applicantId=draft-preview") && String(url).includes("jobToken=job-a"))).toBe(true);
  });
});
