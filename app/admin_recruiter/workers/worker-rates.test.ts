import { describe, expect, it } from "vitest";
import { compareWorkerRates, parseWorkerRate } from "./worker-rates";
describe("worker rate ordering", () => {
  it("orders rates numerically in both directions", () => {
    const rates = ["$100/hr", "$9/hr", "$30 - $40/hr", "$1,000/hr"];
    expect([...rates].sort((a, b) => compareWorkerRates(a, b, "asc"))).toEqual(["$9/hr", "$30 - $40/hr", "$100/hr", "$1,000/hr"]);
    expect([...rates].sort((a, b) => compareWorkerRates(a, b, "desc"))).toEqual(["$1,000/hr", "$100/hr", "$30 - $40/hr", "$9/hr"]);
  });
  it.each(["asc", "desc"] as const)("keeps missing rates last in %s order", (direction) => {
    expect(["—", "$30/hr", ""].sort((a, b) => compareWorkerRates(a, b, direction))).toEqual(["$30/hr", "—", ""]);
  });
  it("uses the minimum of a range without concatenating endpoints", () => {
    expect(parseWorkerRate("$30 - $40/hr")).toBe(30);
    expect(parseWorkerRate("$1,250.50/hr")).toBe(1250.5);
    expect(parseWorkerRate("$0/hr")).toBe(0);
    expect(parseWorkerRate("—")).toBeNull();
  });
});
