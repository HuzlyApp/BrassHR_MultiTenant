import { describe, expect, it } from "vitest";
import { isMatchCallPackStatus } from "./call-pack-status";

describe("isMatchCallPackStatus", () => {
  it("unlocks Screening Complete and names that include screen", () => {
    expect(isMatchCallPackStatus({ systemKey: "reviewing", statusName: "Screening Complete" })).toBe(
      true
    );
    expect(isMatchCallPackStatus({ statusName: "Screening" })).toBe(true);
  });

  it("unlocks active screening outreach statuses", () => {
    expect(isMatchCallPackStatus({ statusName: "Attempted Contact" })).toBe(true);
    expect(isMatchCallPackStatus({ statusName: "Follow-up Needed" })).toBe(true);
  });

  it("stays locked for New / Not Contacted", () => {
    expect(isMatchCallPackStatus({ systemKey: "new", statusName: "New / Not Contacted" })).toBe(
      false
    );
    expect(isMatchCallPackStatus({ statusName: "Unreachable" })).toBe(false);
  });
});
