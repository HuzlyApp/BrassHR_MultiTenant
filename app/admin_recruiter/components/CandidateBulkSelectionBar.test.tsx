// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CandidateBulkSelectionBar } from "@/app/admin_recruiter/components/CandidateBulkSelectionBar";

describe("CandidateBulkSelectionBar", () => {
  it("shows analyze and reanalyze actions when both callbacks are provided", () => {
    const onAnalyze = vi.fn();
    const onReanalyze = vi.fn();
    render(
      <CandidateBulkSelectionBar
        selectedCount={3}
        eligibleCount={3}
        hideClaim
        onAnalyze={onAnalyze}
        onReanalyze={onReanalyze}
        analyzeLabel="Analyze selected"
        reanalyzeLabel="Reanalyze selected"
        onClear={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyze selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Reanalyze selected" }));
    expect(onAnalyze).toHaveBeenCalledOnce();
    expect(onReanalyze).toHaveBeenCalledOnce();
  });

  it("hides reanalyze when no callback is provided", () => {
    render(
      <CandidateBulkSelectionBar
        selectedCount={2}
        eligibleCount={2}
        hideClaim
        onAnalyze={() => undefined}
        analyzeLabel="Analyze selected"
        onClear={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "Analyze selected" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reanalyze selected" })).toBeNull();
  });
});
