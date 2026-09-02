// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CandidateBulkSelectionBar } from "@/app/admin_recruiter/components/CandidateBulkSelectionBar";

describe("CandidateBulkSelectionBar", () => {
  it("shows snackbar actions for analyze, export, archive, and delete", () => {
    const onAnalyze = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    const onExportCsv = vi.fn();
    const onExportXls = vi.fn();

    render(
      <CandidateBulkSelectionBar
        selectedCount={3}
        eligibleCount={3}
        hideClaim
        onAnalyze={onAnalyze}
        onArchive={onArchive}
        onDelete={onDelete}
        onExportCsv={onExportCsv}
        onExportXls={onExportXls}
        analyzeLabel="Analyze selected"
        onClear={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Analyze selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onAnalyze).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("shows reanalyze when provided", () => {
    const onReanalyze = vi.fn();
    render(
      <CandidateBulkSelectionBar
        selectedCount={2}
        eligibleCount={2}
        hideClaim
        onReanalyze={onReanalyze}
        reanalyzeLabel="Reanalyze selected"
        onClear={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reanalyze selected" }));
    expect(onReanalyze).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Analyze selected" })).toBeNull();
  });
});
