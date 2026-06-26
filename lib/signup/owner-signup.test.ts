import { describe, expect, it } from "vitest";
import {
  normalizeOwnerSignupBody,
  validateOwnerSignupDetails,
  validateOwnerSignupZipForState,
} from "@/lib/signup/owner-signup";

describe("validateOwnerSignupZipForState", () => {
  it("accepts a California ZIP when state is CA", () => {
    expect(validateOwnerSignupZipForState("90012", "CA", "California")).toBeNull();
  });

  it("rejects a New York ZIP when state is California", () => {
    const error = validateOwnerSignupZipForState("10001", "CA", "California");
    expect(error).toMatch(/California/i);
  });

  it("requires a state before validating ZIP", () => {
    expect(validateOwnerSignupZipForState("90012", "", "California")).toMatch(/state/i);
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
