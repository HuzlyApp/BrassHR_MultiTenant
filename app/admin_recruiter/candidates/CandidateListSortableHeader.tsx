"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type {
  CandidateListSortColumn,
  CandidateListSortState,
} from "@/lib/admin/candidate-list-sort";

type CandidateListSortableHeaderProps = {
  column: CandidateListSortColumn;
  label: string;
  align?: "left" | "center";
  sort: CandidateListSortState;
  onSort: (column: CandidateListSortColumn) => void;
};

export function CandidateListSortableHeader({
  column,
  label,
  align = "center",
  sort,
  onSort,
}: CandidateListSortableHeaderProps) {
  const active = sort.column === column;
  const ascending = active && sort.direction === "asc";

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 text-sm font-medium uppercase tracking-[0.08em] text-black transition hover:text-[#0F172A] ${
        align === "left" ? "justify-start" : "w-full justify-center"
      }`}
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      aria-label={`Sort by ${label}`}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      {ascending ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0 text-black" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0 text-black" aria-hidden />
      )}
    </button>
  );
}
