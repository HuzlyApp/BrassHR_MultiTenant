"use client";

import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SURFACE =
  "box-border inline-flex h-8 min-h-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Active page background — branding secondary (navy). */
  activeStyle?: CSSProperties;
  className?: string;
};

/**
 * Figma list pagination: fixed equal height, 8px radius, always shows pages 1–2.
 * Page 2 is disabled when there is no second page of data.
 */
export function ListPaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  activeStyle,
  className = "",
}: Props) {
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotal);
  const pageNumbers = [1, 2] as const;

  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, safePage - 1))}
        disabled={safePage <= 1}
        className={`${SURFACE} gap-1 px-2.5`}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden min-[480px]:inline">Previous</span>
      </button>

      {pageNumbers.map((pageNumber) => {
        const disabled = pageNumber > safeTotal;
        const active = !disabled && pageNumber === safePage;
        return (
          <button
            key={pageNumber}
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(pageNumber)}
            className={`${SURFACE} min-w-8 px-2 ${
              active ? "border-transparent text-white hover:opacity-95" : ""
            }`}
            style={active ? activeStyle : undefined}
            aria-current={active ? "page" : undefined}
          >
            {pageNumber}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(safeTotal, safePage + 1))}
        disabled={safePage >= safeTotal}
        className={`${SURFACE} gap-1 px-2.5`}
      >
        <span className="hidden min-[480px]:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ListPaginationShowLabel({
  pageSize,
  options,
  onPageSizeChange,
  selectClassName,
}: {
  pageSize: number;
  options: number[];
  onPageSizeChange: (size: number) => void;
  selectClassName?: string;
}): ReactNode {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-[#64748B]">
      Show
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className={
          selectClassName ??
          "box-border h-8 rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
        }
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
