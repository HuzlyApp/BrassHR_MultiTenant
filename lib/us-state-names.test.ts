import { describe, expect, it } from "vitest";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";

describe("getStateCodeFromName", () => {
  it("accepts full names, any casing, and two-letter codes", () => {
    expect(getStateCodeFromName("Texas")).toBe("TX");
    expect(getStateCodeFromName("texas")).toBe("TX");
    expect(getStateCodeFromName("TEXAS")).toBe("TX");
    expect(getStateCodeFromName("TX")).toBe("TX");
    expect(getStateCodeFromName("tx")).toBe("TX");
    expect(getStateCodeFromName("California")).toBe("CA");
    expect(getStateCodeFromName("california")).toBe("CA");
  });

  it("rejects unknown values", () => {
    expect(getStateCodeFromName("")).toBeUndefined();
    expect(getStateCodeFromName("XX")).toBeUndefined();
    expect(getStateCodeFromName("Tex")).toBeUndefined();
  });
});

describe("getStateNameFromCode", () => {
  it("maps TX to Texas", () => {
    expect(getStateNameFromCode("TX")).toBe("Texas");
    expect(getStateNameFromCode("tx")).toBe("Texas");
  });
});
