import { describe, expect, it } from "vitest";
import { zipPrefixBelongsToState } from "@/lib/us-zip-by-state";
import {
  isBusinessInfoValid,
  normalizeBusinessInfoBody,
  resolveTenantDisplayName,
  validateBusinessInfoForm,
} from "@/lib/tenant/business-info-validation";

const validInput = {
  companyName: "ABC Staffing Co",
  industry: "Staffing",
  companySize: "10-30",
  state: "California",
  city: "Los Angeles",
  address: "123 Maple Street",
  phone: "(213) 555-0198",
  email: "info@abccompany.com",
  zipCode: "90012",
  ein: "12-3456789",
};

describe("validateBusinessInfoForm", () => {
  it("accepts a complete valid form", () => {
    expect(
      isBusinessInfoValid(validInput, { stateCode: "CA", allowedCityNames: ["Los Angeles"] })
    ).toBe(true);
  });

  it("rejects company names without letters", () => {
    const errors = validateBusinessInfoForm({ ...validInput, companyName: "12345" });
    expect(errors.companyName).toBeTruthy();
  });

  it("rejects invalid phone patterns", () => {
    const errors = validateBusinessInfoForm({ ...validInput, phone: "1111111111" });
    expect(errors.phone).toBeTruthy();
  });

  it("rejects malformed emails", () => {
    const errors = validateBusinessInfoForm({ ...validInput, email: "not-an-email" });
    expect(errors.email).toBeTruthy();
  });

  it("rejects zip codes that do not match the state", () => {
    const errors = validateBusinessInfoForm(
      { ...validInput, zipCode: "10001" },
      { stateCode: "CA", stateName: "California", allowedCityNames: ["Los Angeles"] }
    );
    expect(errors.zipCode).toMatch(/California/i);
  });

  it("validates ZIP from state name when state code is not loaded yet", () => {
    const errors = validateBusinessInfoForm(
      { ...validInput, state: "Texas", city: "Rusk", zipCode: "75785" },
      { stateName: "Texas", allowedCityNames: ["Rusk"] }
    );
    expect(errors.zipCode).toBeUndefined();
  });

  it("rejects cities outside the allowed list", () => {
    const errors = validateBusinessInfoForm(validInput, {
      stateCode: "CA",
      allowedCityNames: ["San Francisco"],
    });
    expect(errors.city).toBeTruthy();
  });

  it("rejects invalid EIN formatting when provided", () => {
    const errors = validateBusinessInfoForm({ ...validInput, ein: "00-1234567" });
    expect(errors.ein).toBeTruthy();
  });

  it("requires EIN during tenant onboarding", () => {
    const errors = validateBusinessInfoForm(
      { ...validInput, ein: "" },
      { stateCode: "CA", allowedCityNames: ["Los Angeles"], requireEin: true }
    );
    expect(errors.ein).toMatch(/required/i);
  });

  it("allows empty business fields when requireAllFields is false", () => {
    expect(
      isBusinessInfoValid(
        {
          companyName: "",
          industry: "",
          companySize: "",
          state: "",
          city: "",
          address: "",
          phone: "",
          email: "",
          zipCode: "",
          ein: "",
        },
        { requireAllFields: false, requireEin: false }
      )
    ).toBe(true);
  });

  it("still validates provided values when requireAllFields is false", () => {
    const errors = validateBusinessInfoForm(
      {
        companyName: "12345",
        industry: "",
        companySize: "",
        state: "",
        city: "",
        address: "",
        phone: "",
        email: "",
        zipCode: "",
        ein: "",
      },
      { requireAllFields: false, requireEin: false }
    );
    expect(errors.companyName).toBeTruthy();
  });
});

describe("zipPrefixBelongsToState", () => {
  it("matches California ZIP prefixes", () => {
    expect(zipPrefixBelongsToState("90012", "CA")).toBe(true);
    expect(zipPrefixBelongsToState("10001", "CA")).toBe(false);
  });
});

describe("resolveTenantDisplayName", () => {
  it("falls back to subdomain when organization name is blank", () => {
    expect(
      resolveTenantDisplayName({
        organizationName: "",
        subdomain: "acme-staffing",
      })
    ).toBe("Acme Staffing");
  });
});

describe("normalizeBusinessInfoBody", () => {
  it("maps API aliases", () => {
    const normalized = normalizeBusinessInfoBody({
      organizationName: " Acme ",
      company_size: "1-10",
      address_line_1: "10 Main St",
      postal_code: "90210-1234",
      email: "HELLO@ACME.COM",
    });
    expect(normalized.companyName).toBe("Acme");
    expect(normalized.companySize).toBe("1-10");
    expect(normalized.zipCode).toBe("90210");
    expect(normalized.email).toBe("hello@acme.com");
  });
});
