import { describe, expect, it } from "vitest";
import {
  SERVICE_AREA_COPY,
  readServiceAreaApiMessage,
  serviceAreaMessage,
} from "@/lib/service-area/copy";

describe("service area public copy", () => {
  it("does not advertise an excluded-state list or statute names", () => {
    const blob = Object.values(SERVICE_AREA_COPY).join(" ").toLowerCase();
    expect(blob).not.toMatch(/california|illinois|connecticut|new york city|aedt|ll144|compliance hold|blocked applicant|rejected/);
    expect(blob).not.toMatch(/we don’t hire|we don't hire|we don’t operate|we don't operate/);
  });

  it("uses the ops location-not-available phrasing", () => {
    expect(SERVICE_AREA_COPY.location_not_available).toBe(
      "This opening isn’t available for the location you selected."
    );
    expect(SERVICE_AREA_COPY.location_not_enabled).toBe("This work location isn’t available yet.");
    expect(SERVICE_AREA_COPY.signup_waitlist).toMatch(/isn’t available for this business location yet/i);
  });

  it("maps API envelopes to copy without naming holds", () => {
    expect(
      readServiceAreaApiMessage({ error: { messageKey: "location_not_enabled", field: "work_state" } })
    ).toBe(serviceAreaMessage("location_not_enabled"));
    expect(readServiceAreaApiMessage({ error: "This work location isn’t available yet." })).toBe(
      "This work location isn’t available yet."
    );
    expect(readServiceAreaApiMessage({}, "Failed to add candidate")).toBe("Failed to add candidate");
  });
});
