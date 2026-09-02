"use client";

import { Archive } from "lucide-react";

type BulkArchiveToolbarButtonProps = {
  count: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

/** Shown in list toolbars when rows are selected — matches BulkDeleteToolbarButton styling. */
export function BulkArchiveToolbarButton({
  count,
  onClick,
  disabled = false,
  className = "",
}: BulkArchiveToolbarButtonProps) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 xl:h-8 xl:w-auto xl:gap-1.5 xl:rounded-lg xl:border-[#CBD5E1] xl:px-3 ${className}`}
      aria-label={`Archive ${count} selected`}
      title="Archive"
    >
      <Archive className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden text-sm font-normal leading-6 xl:inline">Archive</span>
    </button>
  );
}
