"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type BulkDeleteToolbarButtonProps = {
  count: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

/** Shown in list toolbars when rows are selected — matches Filters/Columns styling. */
export function BulkDeleteToolbarButton({
  count,
  onClick,
  disabled = false,
  className = "",
}: BulkDeleteToolbarButtonProps) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 xl:h-8 xl:w-auto xl:gap-1.5 xl:rounded-lg xl:border-[#CBD5E1] xl:px-3 ${className}`}
      aria-label={`Delete ${count} selected`}
      title="Delete"
    >
      <BrandedSvgIcon
        src="/icons/delete-icon.svg"
        className="h-4 w-4 shrink-0"
        color="currentColor"
      />
      <span className="hidden text-sm font-normal leading-6 xl:inline">Delete</span>
    </button>
  );
}
