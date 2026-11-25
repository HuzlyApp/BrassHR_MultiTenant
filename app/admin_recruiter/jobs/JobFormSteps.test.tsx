/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobFormStepCompensation } from "./JobFormSteps";
import { defaultJobFormUiState } from "./job-form-shared";

describe("job compensation feedback", () => {
  it("shows negative minimum and maximum errors beside their inputs", () => {
    render(<JobFormStepCompensation job={{ sourceType: "Internal", professionId: "profession-a", employmentType: "W2", payRateMin: -5, payRateMax: -1 }} ui={{ ...defaultJobFormUiState(), showPayBy: "Range" }} fieldErrors={{ payRateMin: "Pay rate cannot be negative.", payRateMax: "Maximum pay rate cannot be negative." }} onJobChange={vi.fn()} onUiChange={vi.fn()} />);
    expect(screen.getByText("Pay rate cannot be negative.")).toBeInTheDocument();
    expect(screen.getByText("Maximum pay rate cannot be negative.")).toBeInTheDocument();
  });
  it.each([0, 99999999])("warns before publishing suspicious pay %s without silently changing it", (payRateMin) => {
    render(<JobFormStepCompensation job={{ sourceType: "Internal", professionId: "profession-a", employmentType: "W2", payRateMin }} ui={defaultJobFormUiState()} fieldErrors={{}} onJobChange={vi.fn()} onUiChange={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("review this pay rate before publishing");
  });
});
