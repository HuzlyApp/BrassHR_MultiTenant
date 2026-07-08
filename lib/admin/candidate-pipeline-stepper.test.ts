import { describe, expect, it } from "vitest";
import {
  buildCandidatePipelineSteps,
  isApplicantReadyForFinalApproval,
  isFinalApprovalDecisionMade,
  pipelineConnectorFillPercent,
} from "./candidate-pipeline-stepper";

describe("buildCandidatePipelineSteps", () => {
  it("marks application received when worker exists", () => {
    const steps = buildCandidatePipelineSteps(
      { worker: { id: "w1", created_at: "2026-01-01T00:00:00.000Z" } },
      {},
      "w1"
    );
    expect(steps[0]?.completed).toBe(true);
    expect(steps[0]?.subtitle).toBe("Completed");
    expect(steps[1]?.completed).toBe(false);
  });

  it("always includes final approval step", () => {
    const steps = buildCandidatePipelineSteps({}, {}, "w1");
    expect(steps.some((step) => step.id === "final_approval")).toBe(true);
    expect(steps.find((step) => step.id === "final_approval")?.clickable).toBe(false);
  });

  it("marks assessment complete when all skill quizzes are done", () => {
    const steps = buildCandidatePipelineSteps(
      { skillAssessments: { completed: 3, total: 3 } },
      {},
      "w1"
    );
    expect(steps.find((step) => step.id === "assessment")?.completed).toBe(true);
  });

  it("marks interview complete when call 2 is done via call log sync", () => {
    const steps = buildCandidatePipelineSteps(
      {},
      {
        sections: [
          {
            id: "screening",
            rows: [
              { id: "call_1", state: "complete", checked: true },
              { id: "call_2", callLogCompleted: true },
            ],
          },
        ],
      },
      "w1"
    );
    expect(steps.find((step) => step.id === "screening")?.completed).toBe(true);
    expect(steps.find((step) => step.id === "interview")?.completed).toBe(true);
  });

  it("marks assessment complete from checklist meta when profile counts are missing", () => {
    const steps = buildCandidatePipelineSteps(
      {},
      {
        meta: { skillAssessments: { completed: 2, total: 2 } },
      },
      "w1"
    );
    expect(steps.find((step) => step.id === "assessment")?.completed).toBe(true);
  });

  it("enables final approval link when applicant steps are complete and progress is ready", () => {
    const steps = buildCandidatePipelineSteps(
      {
        worker: { id: "w1", created_at: "2026-01-01T00:00:00.000Z" },
        skillAssessments: { completed: 2, total: 2 },
        references: [{}],
        onboardingCompletion: { percent: 80 },
      },
      {
        sections: [
          {
            id: "screening",
            rows: [
              { id: "call_1", state: "complete", checked: true },
              { id: "call_2", state: "complete", checked: true },
            ],
          },
        ],
        meta: { progressPercent: 70 },
        tracker: { done: [true, true, true, true] },
      },
      "w1"
    );

    const finalApproval = steps.find((step) => step.id === "final_approval");
    expect(finalApproval?.clickable).toBe(true);
    expect(finalApproval?.href).toBe("/admin_recruiter/new/final-approval/w1");
    expect(steps.some((step) => step.id === "onboarded")).toBe(false);
  });

  it("marks final approval completed and shows onboarded after approval", () => {
    const steps = buildCandidatePipelineSteps(
      { worker: { id: "w1", status: "approved" } },
      {},
      "w1"
    );
    const finalApproval = steps.find((step) => step.id === "final_approval");
    const onboarded = steps.find((step) => step.id === "onboarded");

    expect(finalApproval?.completed).toBe(true);
    expect(finalApproval?.subtitle).toBe("Completed");
    expect(finalApproval?.clickable).toBe(false);
    expect(onboarded?.label).toBe("Onboarded");
    expect(onboarded?.subtitle).toBe("Welcome Aboard!");
    expect(onboarded?.clickable).toBe(true);
    expect(onboarded?.href).toBe("/admin_recruiter/new/onboard-applicant/w1");
  });

  it("marks final approval when checklist worker uses status_label", () => {
    const steps = buildCandidatePipelineSteps(
      {},
      { worker: { id: "w1", status_label: "Approved" } },
      "w1"
    );
    expect(steps.find((step) => step.id === "final_approval")?.completed).toBe(true);
  });
});

describe("isFinalApprovalDecisionMade", () => {
  it("returns true for approved, converted, and disapproved", () => {
    expect(isFinalApprovalDecisionMade("approved")).toBe(true);
    expect(isFinalApprovalDecisionMade("converted")).toBe(true);
    expect(isFinalApprovalDecisionMade("disapproved")).toBe(true);
    expect(isFinalApprovalDecisionMade("for_approval")).toBe(false);
    expect(isFinalApprovalDecisionMade("new")).toBe(false);
  });
});

describe("for_approval pipeline stage", () => {
  it("marks final approval completed for for_approval without showing onboarded", () => {
    const steps = buildCandidatePipelineSteps(
      { worker: { id: "w1", status: "for_approval" } },
      {},
      "w1"
    );
    const finalApproval = steps.find((step) => step.id === "final_approval");
    expect(finalApproval?.completed).toBe(true);
    expect(finalApproval?.subtitle).toBe("Completed");
    expect(finalApproval?.clickable).toBe(true);
    expect(steps.some((step) => step.id === "onboarded")).toBe(false);
  });
});

describe("isApplicantReadyForFinalApproval", () => {
  it("returns false until prerequisite pipeline steps are complete", () => {
    expect(
      isApplicantReadyForFinalApproval(
        { worker: { id: "w1", created_at: "2026-01-01" } },
        { meta: { progressPercent: 90 }, tracker: { done: [true, true, true, true, true, true] } }
      )
    ).toBe(false);
  });
});

describe("pipelineConnectorFillPercent", () => {
  it("returns zero when nothing is complete", () => {
    const steps = buildCandidatePipelineSteps({}, {}, "w1");
    expect(pipelineConnectorFillPercent(steps)).toBe(0);
  });

  it("returns full width when every step is complete", () => {
    const steps = buildCandidatePipelineSteps(
      {
        worker: { id: "w1", status: "approved", created_at: "2026-01-01" },
        skillAssessments: { completed: 2, total: 2 },
        references: [{}, {}],
        onboardingCompletion: { percent: 100 },
      },
      {
        sections: [
          {
            id: "screening",
            rows: [
              { id: "call_1", state: "complete", checked: true },
              { id: "call_2", state: "complete", checked: true },
            ],
          },
        ],
        meta: { progressPercent: 100 },
        tracker: { done: [true, true, true, true, true, true] },
      },
      "w1"
    );
    expect(steps.every((step) => step.completed)).toBe(true);
    expect(pipelineConnectorFillPercent(steps)).toBe(100);
  });
});
