"use client";

import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";

type CandidatesCardBulkSelectHeaderProps = {
  bulkSelectEnabled: boolean;
  onBulkSelectEnabledChange: (enabled: boolean) => void;
  selectAllChecked: boolean;
  selectAllIndeterminate?: boolean;
  selectAllDisabled?: boolean;
  onSelectAllChange: () => void;
};

/** Card-view controls: enable bulk mode, then select all eligible on the page. */
export function CandidatesCardBulkSelectHeader({
  bulkSelectEnabled,
  onBulkSelectEnabledChange,
  selectAllChecked,
  selectAllIndeterminate = false,
  selectAllDisabled = false,
  onSelectAllChange,
}: CandidatesCardBulkSelectHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-1 pt-4 sm:px-5 sm:pt-5">
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
            aria-label="Select all eligible candidates on this page"
          />
          <span className="select-none text-sm font-normal leading-5 text-[#374151]">
            Select All candidates
          </span>
        </label>
      ) : null}
    </div>
  );
}
