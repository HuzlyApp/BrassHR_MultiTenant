// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DynamicStepRenderer } from "@/app/components/onboarding/DynamicStepRenderer";
import ApplicantStepPage from "@/app/components/onboarding/ApplicantStepPage";
import ApplicantProgressTracker from "@/app/components/onboarding/ApplicantProgressTracker";
import ApplicantOnboardingPage from "@/app/components/onboarding/ApplicantOnboardingPage";
import { BackgroundCheckStep } from "@/app/components/onboarding/applicant-steps/ApplicantStepViews";
import { publishedWorkflow } from "@/lib/onboarding/applicant-workflow-fixtures";
import type { ApplicantOnboardingApi } from "@/app/components/onboarding/ApplicantOnboardingPage";

function createMockApi(overrides?: Partial<ApplicantOnboardingApi>): ApplicantOnboardingApi {
  return {
    getApplicantWorkflow: async () => publishedWorkflow,
    getApplicantStepStatuses: async () =>
      publishedWorkflow.steps.map((step) => ({
        stepId: step.id,
        status: "not_started",
      })),
    completeStep: async ({ stepId }) => ({
      stepId,
      status: "completed",
    }),
    ...overrides,
  };
}

describe("DynamicStepRenderer", () => {
  it("renders fallback UI for unsupported step type", () => {
    const unknownStep = {
      id: "step_custom",
      type: "custom_unsupported_step",
      title: "Custom Unsupported Step",
      description: "",
      required: true,
      day: 1,
      order: 1,
      settings: {},
    };

    render(<DynamicStepRenderer step={unknownStep} />);

    expect(screen.getByText("Custom Unsupported Step")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This onboarding step is configured but does not yet have an applicant-facing screen."
      )
    ).toBeInTheDocument();
  });
});

describe("ApplicantStepPage", () => {
  it("disables continue button when required step is incomplete", () => {
    const step = {
      ...publishedWorkflow.steps[0],
      required: true,
    };

    const status = {
      stepId: step.id,
      status: "not_started" as const,
    };

    render(<ApplicantStepPage step={step} status={status} />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("enables continue button when required step is complete", () => {
    const step = {
      ...publishedWorkflow.steps[0],
      required: true,
    };

    const status = {
      stepId: step.id,
      status: "completed" as const,
    };

    render(<ApplicantStepPage step={step} status={status} onContinue={() => undefined} />);

    expect(screen.getAllByRole("button", { name: /continue/i })[0]).toBeEnabled();
  });

  it("allows optional steps to be skipped", () => {
    const optionalStep = {
      ...publishedWorkflow.steps[0],
      required: false,
    };

    const status = {
      stepId: optionalStep.id,
      status: "not_started" as const,
    };

    render(<ApplicantStepPage step={optionalStep} status={status} onSkip={() => undefined} />);

    expect(screen.getByRole("button", { name: /skip/i })).toBeEnabled();
  });
});

describe("ApplicantProgressTracker", () => {
  it("renders progress labels from published workflow steps", () => {
    render(<ApplicantProgressTracker workflow={publishedWorkflow} />);

    expect(screen.getByText("Skill / Qualification Assessment")).toBeInTheDocument();
    expect(screen.getByText("Document Upload")).toBeInTheDocument();
    expect(screen.getByText("Background Check")).toBeInTheDocument();

    expect(screen.queryByText("Add Resume")).not.toBeInTheDocument();
    expect(screen.queryByText("Add References")).not.toBeInTheDocument();
  });
});

describe("ApplicantOnboardingPage", () => {
  it("renders the first configured workflow step instead of legacy Add References page", async () => {
    const mockApi = createMockApi();

    render(
      <ApplicantOnboardingPage
        tenant="subdomaintest"
        applicationId="app_123"
        api={mockApi}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "Skill / Qualification Assessment" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Add References")).not.toBeInTheDocument();
  });

  it("moves to the next workflow step after completing the current step", async () => {
    const mockApi = createMockApi();

    render(
      <ApplicantOnboardingPage
        tenant="subdomaintest"
        applicationId="app_123"
        api={mockApi}
      />
    );

    await screen.findByRole("heading", { name: "Skill / Qualification Assessment" });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByRole("heading", { name: "Document Upload" })).toBeInTheDocument();
  });

  it("shows summary only after all configured workflow steps are complete", async () => {
    const mockApi = createMockApi({
      getApplicantStepStatuses: async () => [
        { stepId: "step_skill_assessment", status: "completed" },
        { stepId: "step_document_upload", status: "completed" },
        { stepId: "step_background_check", status: "completed" },
      ],
    });

    render(
      <ApplicantOnboardingPage
        tenant="subdomaintest"
        applicationId="app_123"
        api={mockApi}
      />
    );

    const summaryButton = await screen.findByRole("button", { name: /summary/i });
    fireEvent.click(summaryButton);

    expect(await screen.findByRole("heading", { name: "Summary" })).toBeInTheDocument();
  });
});

describe("BackgroundCheckStep", () => {
  it("renders provider-powered background check state", () => {
    const step = publishedWorkflow.steps.find((s) => s.type === "background_check")!;

    const status = {
      stepId: "step_background_check",
      status: "waiting_for_candidate" as const,
      metadata: {
        provider: "checker",
        providerStatus: "waiting_for_candidate",
      },
    };

    render(<BackgroundCheckStep step={step} status={status} />);

    expect(screen.getByText("Background Check")).toBeInTheDocument();
    expect(screen.getByText(/Checker/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting for candidate/i)).toBeInTheDocument();
  });

  it("does not show manual completion UI when client performs background check", () => {
    const step = {
      ...publishedWorkflow.steps[2],
      settings: {
        ...publishedWorkflow.steps[2].settings,
        clientPerforms: true,
      },
    };

    render(<BackgroundCheckStep step={step} />);

    expect(screen.queryByRole("button", { name: /mark complete/i })).not.toBeInTheDocument();
    expect(screen.getByText(/background check is being handled/i)).toBeInTheDocument();
  });

  it("renders failed background check state when provider returns failed", () => {
    const step = publishedWorkflow.steps[2];

    const status = {
      stepId: "step_background_check",
      status: "failed" as const,
      metadata: {
        providerStatus: "failed",
        notifyHrOnFail: true,
      },
    };

    render(<BackgroundCheckStep step={step} status={status} />);

    expect(screen.getByText("Background check failed. HR has been notified.")).toBeInTheDocument();
  });
});

describe("legacy add-references routing", () => {
  it("does not render references UI from legacy stepKey when published workflow excludes references", async () => {
    const mockApi = createMockApi();

    render(
      <ApplicantOnboardingPage
        tenant="subdomaintest"
        applicationId="app_123"
        api={mockApi}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "Skill / Qualification Assessment" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Add References")).not.toBeInTheDocument();
  });
});
