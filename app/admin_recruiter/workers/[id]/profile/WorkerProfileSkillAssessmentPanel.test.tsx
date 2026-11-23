// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { scoreLabel } from "./WorkerProfileSkillAssessmentPanel";
describe("worker assessment score display", () => {
  it("does not treat answered questions as the maximum weighted score", () => {
    expect(scoreLabel({ id: "assessment", title: "Test", total_score: 26, answered_count: 10, result_status: "Passed", completed: true })).toBe("Score: 26 · 10 answered");
  });
  it("does not invent a maximum of ten when no denominator is supplied", () => {
    expect(scoreLabel({ id: "assessment", title: "Test", total_score: 26, answered_count: null, result_status: "Passed", completed: true })).toBe("Score: 26");
  });
});
