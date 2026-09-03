"use client";

import { ListSortableHeader } from "@/app/admin_recruiter/components/ListSortableHeader";
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
  return (
    <ListSortableHeader
      label={label}
      align={align}
      active={sort.column === column}
      direction={sort.direction}
      onSort={() => onSort(column)}
    />
  );
}
