import { describe, expect, it } from "vitest";
import {
  formatCityState,
  formatCityStateFromParts,
  locationsMatchCityState,
  normalizeLocationForStorage,
  parseCityStateLocation,
  uniqueCityStateOptions,
} from "@/lib/location/city-state";

describe("parseCityStateLocation", () => {
  it("normalizes Mapbox-style City, State, Country to City, ST", () => {
    expect(formatCityState("Blue Bell, Pennsylvania, United States")).toBe("Blue Bell, PA");
    expect(formatCityState("Dallas, Texas, United States")).toBe("Dallas, TX");
    expect(formatCityState("Neenah, Wisconsin, United States")).toBe("Neenah, WI");
  });

  it("keeps already-canonical City, ST labels", () => {
    expect(formatCityState("Blue Bell, PA")).toBe("Blue Bell, PA");
    expect(formatCityState("Avon Lake, OH")).toBe("Avon Lake, OH");
  });

  it("strips USA / United States / US variants", () => {
    expect(formatCityState("Atlanta, GA, USA")).toBe("Atlanta, GA");
    expect(formatCityState("Edison, NJ, USA")).toBe("Edison, NJ");
    expect(formatCityState("Dallas, TX, US")).toBe("Dallas, TX");
  });

  it("extracts ZIP but keeps it out of the display label", () => {
    const parsed = parseCityStateLocation("Dallas, TX 75244");
    expect(parsed.display).toBe("Dallas, TX");
    expect(parsed.zipCode).toBe("75244");

    const withCountry = parseCityStateLocation("Freeport, Maine 04032, United States");
    expect(withCountry.display).toBe("Freeport, ME");
    expect(withCountry.zipCode).toBe("04032");
  });

  it("strips Hybrid / Remote / On-site work-type noise from location", () => {
    expect(formatCityState("Edison, NJ (On-site)")).toBe("Edison, NJ");
    expect(formatCityState("Dallas, Texas - Remote")).toBe("Dallas, TX");
    expect(formatCityState("Austin, TX (Hybrid)")).toBe("Austin, TX");
  });

  it("strips decorative bullets / colons / parens and dedupes identical City, ST", () => {
    expect(formatCityState("· Blue Bell, PA")).toBe("Blue Bell, PA");
    expect(formatCityState(": Irving, TX")).toBe("Irving, TX");
    expect(formatCityState("(carrboro, NC")).toBe("Carrboro, NC");
    expect(formatCityState("(deerfield, IL")).toBe("Deerfield, IL");
    expect(
      uniqueCityStateOptions([
        "· Blue Bell, PA",
        "Blue Bell, PA",
        "Blue Bell, Pennsylvania, United States",
        ": Irving, TX",
        "Irving, TX",
      ])
    ).toEqual(["Blue Bell, PA", "Irving, TX"]);
  });

  it("dedupes variants into one picklist option", () => {
    expect(
      uniqueCityStateOptions([
        "Blue Bell, PA",
        "Blue Bell, Pennsylvania, United States",
        "Grand Rapids, Michigan",
        "Grand Rapids, Michigan, United States",
        "Texas City, Texas, United States",
        "",
        null,
      ])
    ).toEqual(["Blue Bell, PA", "Grand Rapids, MI", "Texas City, TX"]);
  });

  it("matches filter selection against raw stored variants", () => {
    expect(
      locationsMatchCityState("Blue Bell, PA", "Blue Bell, Pennsylvania, United States")
    ).toBe(true);
    expect(locationsMatchCityState("Dallas, TX", "Dallas, TX 75244")).toBe(true);
    expect(locationsMatchCityState("Dallas, TX", "Austin, TX")).toBe(false);
  });

  it("normalizes storage to City, ST and returns ZIP separately", () => {
    expect(normalizeLocationForStorage("Blue Bell, Pennsylvania, United States")).toEqual({
      location: "Blue Bell, PA",
      zipCode: null,
    });
    expect(normalizeLocationForStorage("Dallas, TX 75244")).toEqual({
      location: "Dallas, TX",
      zipCode: "75244",
    });
  });

  it("formats structured candidate city/state consistently", () => {
    expect(formatCityStateFromParts("Blue Bell", "Pennsylvania")).toBe("Blue Bell, PA");
    expect(formatCityStateFromParts("Blue Bell", "PA")).toBe("Blue Bell, PA");
  });
});
