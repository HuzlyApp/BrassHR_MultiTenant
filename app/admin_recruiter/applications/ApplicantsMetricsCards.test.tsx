// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicantsMetricsCards } from "./ApplicantsMetricsCards";
describe("applicant metric states", () => {
  it("hides misleading zero counts until loading completes", () => {
    const { rerender } = render(<ApplicantsMetricsCards loading />);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByLabelText("Loading Total Applicants")).toBeInTheDocument();
    rerender(<ApplicantsMetricsCards counts={{ total: 13 }} />);
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
  it("ends loading with an explicit failure state", () => {
    render(<ApplicantsMetricsCards error />);
    expect(screen.getAllByText("Could not load metrics")).toHaveLength(4);
    expect(screen.queryByText("0")).toBeNull();
  });
});
