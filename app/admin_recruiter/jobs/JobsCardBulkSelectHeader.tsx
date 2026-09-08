"use client";

import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";

type JobsCardBulkSelectHeaderProps = {
  bulkSelectEnabled: boolean;
  onBulkSelectEnabledChange: (enabled: boolean) => void;
  selectAllChecked: boolean;
  selectAllIndeterminate?: boolean;
  selectAllDisabled?: boolean;
  onSelectAllChange: () => void;
};

/** Card-view controls: enable bulk mode, then select all visible workspace jobs. */
export function JobsCardBulkSelectHeader({
  bulkSelectEnabled,
  onBulkSelectEnabledChange,
  selectAllChecked,
  selectAllIndeterminate = false,
  selectAllDisabled = false,
  onSelectAllChange,
}: JobsCardBulkSelectHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2">
        <ListTableCheckbox
          size="md"
          checked={bulkSelectEnabled}
          onChange={() => onBulkSelectEnabledChange(!bulkSelectEnabled)}
          aria-label="Enable bulk select"
        />
        <span className="select-none text-sm font-normal leading-5 text-[#374151]">Bulk select</span>
      </label>

      {bulkSelectEnabled ? (
        <label className="inline-flex cursor-pointer items-center gap-2">
          <ListTableCheckbox
            size="md"
            checked={selectAllChecked}
            indeterminate={selectAllIndeterminate}
            disabled={selectAllDisabled}
            onChange={onSelectAllChange}
            aria-label="Select all jobs in workspace"
          />
          <span className="select-none text-sm font-normal leading-5 text-[#374151]">
            Select All jobs
          </span>
        </label>
      ) : null}
    </div>
  );
}
