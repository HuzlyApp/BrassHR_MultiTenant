import { describe, expect, it } from "vitest";

/** Mirrors header checkbox math from usePageSelection for unit testing without jsdom. */
function headerState(pageRows: Array<{ id: string; eligible: boolean }>, selectedIds: Set<string>) {
  const eligibleOnPage = pageRows.filter((row) => row.eligible).map((row) => row.id);
  const allEligibleSelected =
    eligibleOnPage.length > 0 && eligibleOnPage.every((id) => selectedIds.has(id));
  const someEligibleSelected = eligibleOnPage.some((id) => selectedIds.has(id));
  return {
    headerChecked: allEligibleSelected,
    headerIndeterminate: someEligibleSelected && !allEligibleSelected,
    selectedEligibleIds: [...selectedIds].filter((id) => eligibleOnPage.includes(id)),
  };
}

function toggleAllEligible(
  pageRows: Array<{ id: string; eligible: boolean }>,
  selectedIds: Set<string>
): Set<string> {
  const eligibleOnPage = pageRows.filter((row) => row.eligible).map((row) => row.id);
  const next = new Set(selectedIds);
  const allSelected =
    eligibleOnPage.length > 0 && eligibleOnPage.every((id) => next.has(id));
  if (allSelected) {
    for (const id of eligibleOnPage) next.delete(id);
  } else {
    for (const id of eligibleOnPage) next.add(id);
  }
  return next;
}

describe("page selection header math", () => {
  const pageRows = [
    { id: "a", eligible: true },
    { id: "b", eligible: true },
    { id: "c", eligible: false },
  ];

  it("selects one candidate", () => {
    const selected = new Set(["a"]);
    expect(headerState(pageRows, selected).selectedEligibleIds).toEqual(["a"]);
    expect(headerState(pageRows, selected).headerIndeterminate).toBe(true);
  });

  it("deselects one candidate", () => {
    const selected = new Set<string>();
    expect(headerState(pageRows, selected).headerChecked).toBe(false);
  });

  it("select-all only includes eligible page rows", () => {
    const next = toggleAllEligible(pageRows, new Set());
    expect([...next].sort()).toEqual(["a", "b"]);
    expect(headerState(pageRows, next).headerChecked).toBe(true);
  });

  it("clears all selections", () => {
    const next = toggleAllEligible(pageRows, new Set(["a", "b"]));
    expect(next.size).toBe(0);
  });

  it("keeps indeterminate when some eligible selected", () => {
    expect(headerState(pageRows, new Set(["a"])).headerIndeterminate).toBe(true);
  });
});
