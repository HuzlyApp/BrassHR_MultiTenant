// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Guard from "./ApplicantOnboardingRouteGuard";
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/application/add-references", useSearchParams: () => new URLSearchParams("tenant=qa&job_token=job-a") }));
vi.mock("@/lib/tenant/use-onboarding-tenant", () => ({ useOnboardingTenant: () => ({ replace: mocks.replace }) }));
vi.mock("./OnboardingConfigProvider", () => ({ useOnboardingConfigOptional: () => ({ waitingOnInternal: true, workflowPhase: "pre_hire", progressHydrated: true, loadingConfig: false, loadingProgress: false, config: null, progress: { submittedAt: "2026-11-24" } }) }));
vi.mock("@/lib/onboarding/applicant-session-context", () => ({ useApplicantSession: () => ({ sessionReady: true, sessionLoading: false }) }));
vi.mock("@/lib/onboarding/tenant-step-navigation", () => ({ resolveApplicantEnabledSteps: () => [] }));
vi.mock("@/lib/onboarding/use-auto-skip-non-navigable-steps", () => ({ useAutoSkipNonNavigableApplicantSteps: () => undefined }));
vi.mock("@/lib/onboarding/resolve-applicant-onboarding-route", () => ({ resolveApplicantOnboardingRoute: () => ({ status: "redirect", href: "/application/application-status?tenant=qa&job_token=job-a" }) }));
vi.mock("./AwaitingRecruiterReviewScreen", () => ({ default: () => <p>Application submitted</p> }));
beforeEach(() => mocks.replace.mockReset());
describe("submitted application confirmation URL", () => {
  it("honors the validated status redirect while showing the submitted confirmation", async () => {
    render(<Guard>Reference form</Guard>);
    expect(screen.getByText("Application submitted")).toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/application/application-status?tenant=qa&job_token=job-a"));
    expect(screen.queryByText("Reference form")).not.toBeInTheDocument();
  });
});
