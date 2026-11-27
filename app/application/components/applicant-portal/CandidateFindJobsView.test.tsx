// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { CandidateFindJobsView, type CandidateJobCardModel } from "./CandidateFindJobsView";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tenant=zipstaff") }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props) }));

const jobs: CandidateJobCardModel[] = Array.from({ length: 12 }, (_, index) => ({
  key: `job-${index}`, token: `token-${index}`, title: `Registered Nurse ${index + 1}`,
  location: "Austin, TX", employmentType: "W2", locationType: "Onsite",
  postedLabel: "Posted: September 2, 2026", payLabel: `$${40 + index} / hr`,
  descriptionHtml: "<p>Provide patient care.</p>", qualifications: "", responsibilities: "", benefits: "", applied: index === 1,
}));

function setup(overrides: Partial<React.ComponentProps<typeof CandidateFindJobsView>> = {}) {
  const props = {
    companyName: "ZipStaff", jobs, loading: false, error: null, query: "", location: "", employmentType: "",
    onQueryChange: vi.fn(), onLocationChange: vi.fn(), onEmploymentTypeChange: vi.fn(), onSearch: vi.fn(), onApply: vi.fn(), ...overrides,
  };
  render(<CandidateFindJobsView {...props} />);
  return props;
}

describe("candidate Find Jobs", () => {
  it("selects roles and keeps applied jobs from being submitted again", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    expect(props.onApply).toHaveBeenCalledWith("token-0");
    fireEvent.click(screen.getByRole("button", { name: /Registered Nurse 2 ZipStaff/ }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Registered Nurse 2");
    expect(screen.getByRole("button", { name: "Applied" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Open public job" })).toHaveAttribute("href", "/jobs/token-1?tenant=zipstaff");
  });

  it("updates the selected role when paging and sorting", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Registered Nurse 12");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort jobs" }), { target: { value: "pay" } });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Registered Nurse 12");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("submits searches and exposes location and employment filters", () => {
    const props = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Job title or keyword" }), { target: { value: "nurse" } });
    expect(props.onQueryChange).toHaveBeenCalledWith("nurse");
    fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
    expect(props.onSearch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Filter jobs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "Austin" } });
    expect(props.onLocationChange).toHaveBeenCalledWith("Austin");
    fireEvent.change(screen.getByRole("combobox", { name: "Work type" }), { target: { value: "W2" } });
    expect(props.onEmploymentTypeChange).toHaveBeenCalledWith("W2");
  });

  it("toggles saved state and description disclosure", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save job", exact: true }));
    expect(screen.getByRole("button", { name: "Unsave job" })).toHaveAttribute("aria-pressed", "true");
    const detail = screen.getByRole("article");
    fireEvent.click(within(detail).getByRole("button", { name: "Show Less" }));
    expect(within(detail).getByRole("button", { name: "Show More" })).toHaveAttribute("aria-expanded", "false");
  });
});
