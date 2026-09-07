// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllCandidatesToolbar } from "@/app/admin_recruiter/candidates/AllCandidatesToolbar";

vi.mock("@/app/admin_recruiter/jobs/JobsViewToggle", () => ({
  JobsViewToggle: () => <div data-testid="view-toggle" />,
}));

vi.mock("@/app/admin_recruiter/components/FilterChipInput", () => ({
  FilterChipInput: ({
    values,
    onChange,
    onEnterSubmit,
    "aria-label": ariaLabel,
  }: {
    values: string[];
    onChange: (next: string[]) => void;
    onEnterSubmit?: (next: string[]) => void;
    "aria-label"?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={values.join(", ")}
      onChange={(event) =>
        onChange(
          event.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      }
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onEnterSubmit?.(
            (event.currentTarget as HTMLInputElement).value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
        }
      }}
    />
  ),
}));

describe("AllCandidatesToolbar search UX", () => {
  const baseProps = {
    query: "",
    skillsFilter: "",
    onApplySearch: vi.fn(),
    onResetSearch: vi.fn(),
    onOpenFilters: vi.fn(),
    onEditColumns: vi.fn(),
    activeFilterCount: 0,
    view: "list" as const,
    onViewChange: vi.fn(),
    highlightMultiJob: false,
    onHighlightMultiJobChange: vi.fn(),
  };

  it("submits free-text search on button click", () => {
    const onApplySearch = vi.fn();
    render(<AllCandidatesToolbar {...baseProps} onApplySearch={onApplySearch} />);
    fireEvent.change(screen.getByLabelText("Search applicant or resume"), {
      target: { value: "  Shawnda  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onApplySearch).toHaveBeenCalledWith({ query: "Shawnda", skillsFilter: "" });
  });

  it("submits on Enter in the applicant/resume field", () => {
    const onApplySearch = vi.fn();
    render(<AllCandidatesToolbar {...baseProps} onApplySearch={onApplySearch} />);
    const input = screen.getByLabelText("Search applicant or resume");
    fireEvent.change(input, { target: { value: "jane.doe@example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onApplySearch).toHaveBeenCalledWith({
      query: "jane.doe@example.com",
      skillsFilter: "",
    });
  });

  it("documents AND semantics and can combine q + skills", () => {
    const onApplySearch = vi.fn();
    render(<AllCandidatesToolbar {...baseProps} onApplySearch={onApplySearch} />);
    expect(screen.getByText(/must match both \(AND\)/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search applicant or resume"), {
      target: { value: "Shawnda" },
    });
    fireEvent.change(screen.getByLabelText("Filter by Skills"), {
      target: { value: "ICU, BLS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onApplySearch).toHaveBeenCalledWith({
      query: "Shawnda",
      skillsFilter: "ICU, BLS",
    });
  });

  it("shows searching state and blocks duplicate submissions", () => {
    const onApplySearch = vi.fn();
    render(
      <AllCandidatesToolbar {...baseProps} onApplySearch={onApplySearch} searching query="x" />
    );
    expect(screen.getByRole("button", { name: "Searching…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Searching…" }));
    expect(onApplySearch).not.toHaveBeenCalled();
  });

  it("reset clears draft fields and calls onResetSearch", () => {
    const onResetSearch = vi.fn();
    render(
      <AllCandidatesToolbar
        {...baseProps}
        query="Shawnda"
        skillsFilter="ICU"
        onResetSearch={onResetSearch}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Reset search/i }));
    expect(onResetSearch).toHaveBeenCalled();
    expect((screen.getByLabelText("Search applicant or resume") as HTMLInputElement).value).toBe(
      ""
    );
  });
});
