import { describe, expect, it } from "vitest";
import { isNewYorkCityPlace } from "@/lib/service-area/nyc";
import { isPlausibleCityName, isUnverifiableWorkCity } from "@/lib/service-area/known-cities";

describe("NYC aliases", () => {
  it("recognizes boroughs and requested neighborhoods", () => {
    for (const city of [
      "Astoria",
      "Flushing",
      "Jamaica",
      "Long Island City",
      "Williamsburg",
      "Harlem",
      "Manhattan",
      "Brooklyn",
      "Queens",
      "Bronx",
      "Staten Island",
      "New York City",
      "NYC",
    ]) {
      expect(isNewYorkCityPlace(city, { state: "NY" }), city).toBe(true);
    }
  });

  it("does not treat Albany as NYC", () => {
    expect(isNewYorkCityPlace("Albany", { state: "NY" })).toBe(false);
  });
});

describe("unverifiable cities", () => {
  it("rejects asdf in an allowed state", () => {
    expect(isPlausibleCityName("asdf")).toBe(false);
    expect(isUnverifiableWorkCity({ city: "asdf", state: "TX" })).toBe(true);
  });

  it("does not treat CA garbage as unknown because the state is held", () => {
    expect(isUnverifiableWorkCity({ city: "asdf", state: "CA" })).toBe(false);
  });
});
