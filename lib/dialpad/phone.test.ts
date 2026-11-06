import { describe, expect, it } from "vitest";
import { toE164 } from "@/lib/dialpad/phone";

describe("toE164", () => {
  it("formats US numbers and keeps international numbers that already include +", () => {
    expect(toE164("(415) 555-0134")).toBe("+14155550134");
    expect(toE164("4155550134")).toBe("+14155550134");
    expect(toE164("1 415 555 0134")).toBe("+14155550134");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("rejects numbers that are not a full E.164 value", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("555-0134")).toBeNull();
    expect(toE164("+123")).toBeNull();
  });
});
