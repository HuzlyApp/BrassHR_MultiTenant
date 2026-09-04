// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CandidateBulkSelectionBar } from "@/app/admin_recruiter/components/CandidateBulkSelectionBar";

describe("CandidateBulkSelectionBar", () => {
  it("shows snackbar actions for export, archive, and delete", () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    const onExportCsv = vi.fn();
    const onExportXls = vi.fn();

    render(
      <CandidateBulkSelectionBar
        selectedCount={3}
        eligibleCount={3}
        hideClaim
        onArchive={onArchive}
        onDelete={onDelete}
        onExportCsv={onExportCsv}
        onExportXls={onExportXls}
        onClear={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /analyze/i })).toBeNull();
  });
});
