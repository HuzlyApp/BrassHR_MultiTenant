"use client";

import { JOBS_BOARD_SORTS, type JobsBoardSort } from "@/lib/jobs/public-jobs-board";
import { JobsBoardPillMenu } from "@/app/jobs/JobsBoardPillMenu";

const SORT_LABELS: Record<JobsBoardSort, string> = {
  recent: "Most recent",
  relevant: "Most relevant",
};

const SORT_OPTIONS = JOBS_BOARD_SORTS.map((sort) => ({
  value: sort,
  label: SORT_LABELS[sort],
}));

export function JobsBoardSortMenu({
  value,
  onChange,
}: {
  value: JobsBoardSort;
  onChange: (sort: JobsBoardSort) => void;
}) {
  return (
    <JobsBoardPillMenu
      value={value}
      options={SORT_OPTIONS}
      onChange={(next) => onChange(next as JobsBoardSort)}
      ariaLabel="Sort jobs"
      placeholder="Sort jobs"
    />
  );
}
