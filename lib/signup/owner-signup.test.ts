import { describe, expect, it } from "vitest";
import {
  normalizeOwnerSignupBody,
  signupAddress1ValidationMessage,
  signupAddress2ValidationMessage,
  signupAddressVerificationMessage,
  validateOwnerSignupDetails,
  validateOwnerSignupPassword,
  validateOwnerSignupZipForState,
} from "@/lib/signup/owner-signup";

describe("validateOwnerSignupPassword", () => {
  it("requires at least one number", () => {
    expect(validateOwnerSignupPassword("PasswordOnly")).toMatch(/number/i);
    expect(validateOwnerSignupPassword("Password1234")).toBeNull();
  });

  it("still requires length and letter casing", () => {
    expect(validateOwnerSignupPassword("Pass1")).toMatch(/12 characters/i);
    expect(validateOwnerSignupPassword("password1234")).toMatch(/uppercase/i);
    expect(validateOwnerSignupPassword("PASSWORD1234")).toMatch(/lowercase/i);
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
    expect(validateOwnerSignupZipForState("90012", "", "California")).toMatch(/state/i);
  });
});

describe("validateOwnerSignupDetails", () => {
  const validBase = {
    firstName: "Jane",
    lastName: "Doe",
    workEmail: "jane@acme.com",
    jobTitle: "HR",
    city: "Los Angeles",
    state: "California",
    zipCode: "90012",
    address1: "123 Main Street",
    address2: "",
  };

  it("requires a 5-digit ZIP code", () => {
    const error = validateOwnerSignupDetails({
      ...validBase,
      zipCode: "900",
    });
    expect(error).toMatch(/5-digit/i);
  });

  it("requires a street number in address 1", () => {
    const error = validateOwnerSignupDetails({
      ...validBase,
      address1: "uyrtert",
    });
    expect(error).toMatch(/street number/i);
  });

  it("accepts valid address details", () => {
    expect(validateOwnerSignupDetails(validBase)).toBeNull();
  });
});

describe("signupAddress1ValidationMessage", () => {
  it("rejects text without a street number", () => {
    expect(signupAddress1ValidationMessage("uyrtert")).toMatch(/street number/i);
  });
});

describe("signupAddressVerificationMessage", () => {
  it("requires a selected Mapbox address after format validation passes", () => {
    expect(
      signupAddressVerificationMessage({
        address1: "100 Main Street",
        isAddressVerified: false,
        showError: true,
      })
    ).toMatch(/select a street address/i);
  });

  it("returns null when address is verified", () => {
    expect(
      signupAddressVerificationMessage({
        address1: "100 Main Street",
        isAddressVerified: true,
        showError: true,
      })
    ).toBeNull();
  });
});

describe("signupAddress2ValidationMessage", () => {
  it("skips validation when same as address 1", () => {
    expect(signupAddress2ValidationMessage("", { sameAsAddress1: true })).toBeNull();
  });
});

describe("normalizeOwnerSignupBody", () => {
  it("keeps only the first 5 ZIP digits", () => {
    const normalized = normalizeOwnerSignupBody({ zipCode: "90210-1234" });
    expect(normalized.zipCode).toBe("90210");
  });
});
