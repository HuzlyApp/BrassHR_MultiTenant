import { describe, expect, it } from "vitest";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";

describe("service area public copy", () => {
  it("does not advertise an excluded-state list or statute names", () => {
    const blob = Object.values(SERVICE_AREA_COPY).join(" ").toLowerCase();
    expect(blob).not.toMatch(/california|illinois|connecticut|new york city|aedt|ll144|compliance hold|blocked applicant|rejected/);
    expect(blob).not.toMatch(/we don’t hire|we don't hire|we don’t operate|we don't operate/);
  });
});
