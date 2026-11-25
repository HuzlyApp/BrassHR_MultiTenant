/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobPostPreviewModal } from "./JobPostPreviewModal";
import { defaultJobFormUiState } from "./job-form-shared";
describe("job post preview", () => {
  it("includes the configured screening questions alongside the description", () => {
    render(<JobPostPreviewModal open onOpenChange={vi.fn()} job={{ sourceType: "Internal", professionId: "profession-a", employmentType: "W2", publicTitle: "Nurse", publicDescription: "Provide nursing care." }} ui={defaultJobFormUiState()} companyName="Zippy Corp" brandStyle={{}} screeningQuestions={[{ question: "Do you have nursing experience?", questionType: "yes_no", isRequired: true }]} />);
    expect(screen.getByText("Screening questions")).toBeInTheDocument();
    expect(screen.getByText("Do you have nursing experience? (Required)")).toBeInTheDocument();
  });
});
