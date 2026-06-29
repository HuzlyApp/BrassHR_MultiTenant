import { describe, expect, it } from "vitest";
import {
  buildCandidatePipelineSteps,
  pipelineConnectorFillPercent,
} from "./candidate-pipeline-stepper";

describe("buildCandidatePipelineSteps", () => {
  it("marks application received when worker exists", () => {
    const steps = buildCandidatePipelineSteps(
      { worker: { id: "w1", created_at: "2026-01-01T00:00:00.000Z" } },
      {}
    );
    expect(steps[0]?.completed).toBe(true);
    expect(steps[1]?.completed).toBe(false);
  });

  it("marks assessment complete when all skill quizzes are done", () => {
    const steps = buildCandidatePipelineSteps(
      { skillAssessments: { completed: 3, total: 3 } },
      {}
    );
    expect(steps.find((step) => step.id === "assessment")?.completed).toBe(true);
  });

  it("marks final approval when worker status is approved", () => {
    const steps = buildCandidatePipelineSteps(
      { worker: { id: "w1", status: "approved" } },
      {}
    );
    expect(steps.find((step) => step.id === "final_approval")?.completed).toBe(true);
  });
});

describe("pipelineConnectorFillPercent", () => {
  it("returns zero when nothing is complete", () => {
    const steps = buildCandidatePipelineSteps({}, {});
    expect(pipelineConnectorFillPercent(steps)).toBe(0);
  });

  it("returns full width when every step is complete", () => {
    const steps = buildCandidatePipelineSteps(
      {
        worker: { id: "w1", status: "approved", created_at: "2026-01-01" },
        skillAssessments: { completed: 2, total: 2 },
        references: [{}, {}],
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
          {
            id: "final",
            rows: [{ id: "welcome_email", state: "complete", checked: true }],
          },
        ],
      }
    );
    expect(steps.every((step) => step.completed)).toBe(true);
    expect(pipelineConnectorFillPercent(steps)).toBe(100);
  });
});
