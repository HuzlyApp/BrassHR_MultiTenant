"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { ListExportDropdown } from "@/app/admin_recruiter/components/ListExportDropdown";
import {
  BULK_SELECTION_SNACKBAR_BG,
  BULK_SELECTION_SNACKBAR_CLASS,
  BULK_SELECTION_SNACKBAR_LABEL_CLASS,
  BULK_SELECTION_SNACKBAR_ACTION_CLASS,
  BULK_SELECTION_SNACKBAR_ICON_BTN_CLASS,
} from "@/app/admin_recruiter/components/bulk-selection-snackbar-styles";
import { RotateCcw } from "lucide-react";

const ARCHIVE_ICON_SRC = "/icons/jobs-icons/archived.svg";

type WorkersBulkSelectionSnackbarProps = {
  selectedCount: number;
  archivedView?: boolean;
  archiveBusy?: boolean;
  exportDisabled?: boolean;
  canEdit?: boolean;
  onArchive?: () => void;
  onExportCsv: () => void;
  onExportXls: () => void;
  onClear: () => void;
};

function SnackbarGlyph({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  return (
    <span className="relative size-4 shrink-0 overflow-hidden" aria-hidden>
      <BrandedSvgIcon
        src={src}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
        color="#FFFFFF"
      />
    </span>
  );
}

/**
 * Workers multi-select snackbar — same yellow branded surface as Jobs / Applicants.
 * Actions: Export, Archive/Restore (edit grant), Clear.
 */
export function WorkersBulkSelectionSnackbar({
  selectedCount,
  archivedView = false,
  archiveBusy = false,
  exportDisabled = false,
  canEdit = true,
  onArchive,
  onExportCsv,
  onExportXls,
  onClear,
}: WorkersBulkSelectionSnackbarProps) {
  if (selectedCount <= 0) return null;

  const selectionLabel =
    selectedCount === 1 ? "1 worker selected" : `${selectedCount} workers selected`;
  const archiveLabel = archivedView ? "Restore" : "Archive";

  return (
    <div
      className={`sticky top-0 z-20 ${BULK_SELECTION_SNACKBAR_CLASS} rounded-t-xl border-x-0 border-t-0`}
      style={{
        backgroundColor: BULK_SELECTION_SNACKBAR_BG,
        borderColor: "var(--brand-primary)",
      }}
      role="status"
      aria-live="polite"
    >
      <p className={BULK_SELECTION_SNACKBAR_LABEL_CLASS}>{selectionLabel}</p>

      <div className="flex flex-wrap items-center gap-2">
        <ListExportDropdown
          variant="snackbar"
          onExportCsv={onExportCsv}
          onExportXls={onExportXls}
          disabled={archiveBusy || exportDisabled}
        />
        {canEdit && onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={archiveBusy}
            className={BULK_SELECTION_SNACKBAR_ACTION_CLASS}
          >
            <SnackbarGlyph src={ARCHIVE_ICON_SRC} className="size-3.5" />
            {archiveBusy ? (archivedView ? "Restoring…" : "Archiving…") : archiveLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          disabled={archiveBusy}
          className={BULK_SELECTION_SNACKBAR_ICON_BTN_CLASS}
          aria-label="Clear selection"
          title="Clear selection"
        >
          <RotateCcw className="size-4 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}
