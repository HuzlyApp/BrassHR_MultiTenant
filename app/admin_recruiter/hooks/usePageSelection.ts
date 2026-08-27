"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

export type SelectableRow = {
  id: string;
  eligible: boolean;
};

export type PageSelectionState = {
  selectedIds: Set<string>;
  selectedCount: number;
  selectedEligibleIds: string[];
  selectedEligibleCount: number;
  allEligibleSelected: boolean;
  someEligibleSelected: boolean;
  headerChecked: boolean;
  headerIndeterminate: boolean;
  selectionScopeLabel: string;
  toggleOne: (id: string, eligible?: boolean) => void;
  toggleAllEligibleOnPage: () => void;
  clearSelection: () => void;
  removeIds: (ids: Iterable<string>) => void;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
};

/**
 * Page-scoped bulk selection by stable row IDs.
 * Select-all applies only to eligible rows on the current page.
 */
export function usePageSelection(options: {
  pageRows: SelectableRow[];
  /** Clear selection when this key changes (page, filters, search). Sorting should NOT change it. */
  clearKey: string;
}): PageSelectionState {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [options.clearKey]);

  const eligibleOnPage = useMemo(
    () => options.pageRows.filter((row) => row.eligible).map((row) => row.id),
    [options.pageRows]
  );

  const eligibleSet = useMemo(() => new Set(eligibleOnPage), [eligibleOnPage]);

  // Drop stale / no-longer-visible IDs after refresh; keep only IDs still on this page snapshot
  // is intentionally NOT done here for sort-preserving behavior — callers pass clearKey for
  // page/filter/search. After claim, callers should removeIds.

  const selectedEligibleIds = useMemo(
    () => [...selectedIds].filter((id) => eligibleSet.has(id)),
    [selectedIds, eligibleSet]
  );

  const allEligibleSelected =
    eligibleOnPage.length > 0 && eligibleOnPage.every((id) => selectedIds.has(id));
  const someEligibleSelected = eligibleOnPage.some((id) => selectedIds.has(id));

  const toggleOne = useCallback((id: string, eligible = true) => {
    if (!eligible) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllEligibleOnPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected =
        eligibleOnPage.length > 0 && eligibleOnPage.every((id) => next.has(id));
      if (allSelected) {
        for (const id of eligibleOnPage) next.delete(id);
      } else {
        for (const id of eligibleOnPage) next.add(id);
      }
      return next;
    });
  }, [eligibleOnPage]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const removeIds = useCallback((ids: Iterable<string>) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const selectedCount = selectedIds.size;
  const selectedEligibleCount = selectedEligibleIds.length;

  const selectionScopeLabel = useMemo(() => {
    if (selectedEligibleCount === 0) return "";
    if (allEligibleSelected) {
      return `All ${selectedEligibleCount} candidate${
        selectedEligibleCount === 1 ? "" : "s"
      } on this page selected`;
    }
    return `${selectedEligibleCount} candidate${
      selectedEligibleCount === 1 ? "" : "s"
    } selected on this page`;
  }, [allEligibleSelected, selectedEligibleCount]);

  return {
    selectedIds,
    selectedCount,
    selectedEligibleIds,
    selectedEligibleCount,
    allEligibleSelected,
    someEligibleSelected,
    headerChecked: allEligibleSelected,
    headerIndeterminate: someEligibleSelected && !allEligibleSelected,
    selectionScopeLabel,
    toggleOne,
    toggleAllEligibleOnPage,
    clearSelection,
    removeIds,
    setSelectedIds,
  };
}
