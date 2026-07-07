import { describe, expect, it } from "vitest";
import {
  normalizeOwnerSignupBody,
  resolveOwnerSignupStateCode,
  validateOwnerSignupDetails,
  validateOwnerSignupZipForState,
} from "@/lib/signup/owner-signup";

describe("resolveOwnerSignupStateCode", () => {
  it("prefers the database state code when present", () => {
    expect(resolveOwnerSignupStateCode("California", "CA")).toBe("CA");
  });

  it("falls back to the canonical state name map when DB lookup is empty", () => {
    expect(resolveOwnerSignupStateCode("Texas", null)).toBe("TX");
    expect(resolveOwnerSignupStateCode("Texas", undefined)).toBe("TX");
  });

  it("returns null for unknown state names", () => {
    expect(resolveOwnerSignupStateCode("Not A State", null)).toBeNull();
  });
});

describe("validateOwnerSignupZipForState", () => {
  it("accepts a California ZIP when state is CA", () => {
    expect(validateOwnerSignupZipForState("90012", "CA", "California")).toBeNull();
  });

  it("rejects a New York ZIP when state is California", () => {
    const error = validateOwnerSignupZipForState("10001", "CA", "California");
    expect(error).toMatch(/California/i);
  });

  it("requires a state before validating ZIP", () => {
    expect(validateOwnerSignupZipForState("90012", "", "")).toMatch(/state/i);
  });

  it("resolves state code from state name when code is missing", () => {
    expect(validateOwnerSignupZipForState("90012", "", "California")).toBeNull();
  });
});

describe("validateOwnerSignupDetails", () => {
  it("requires a 5-digit ZIP code", () => {
    const error = validateOwnerSignupDetails({
      firstName: "Jane",
      lastName: "Doe",
      workEmail: "jane@acme.com",
      jobTitle: "HR",
      city: "Los Angeles",
      state: "California",
      zipCode: "900",
    });
    expect(error).toMatch(/5-digit/i);
  });
});

describe("normalizeOwnerSignupBody", () => {
  it("keeps only the first 5 ZIP digits", () => {
    const normalized = normalizeOwnerSignupBody({ zipCode: "90210-1234" });
    expect(normalized.zipCode).toBe("90210");
  });
});
