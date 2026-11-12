import { describe, expect, it } from "vitest";
import { resolvePersonalProfileFields } from "./resolve-personal-profile-fields";
import type { AccountOrganization, AccountProfile } from "./types";

describe("resolvePersonalProfileFields", () => {
  const profile: AccountProfile = {
    id: "user-1",
    first_name: "Jane",
    last_name: "Owner",
    preferred_name: null,
    full_name: "Jane Owner",
    email: "jane@example.com",
    phone: null,
    birthdate: null,
    avatar_url: null,
    role: "admin",
    job_title: null,
    department_id: null,
    employee_id: null,
    work_location: null,
    bio: null,
    organization_id: "tenant-1",
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    zip_code: null,
    created_at: null,
    updated_at: null,
  };

  const organization: AccountOrganization = {
    id: "tenant-1",
    name: "Acme Staffing",
    legal_name: null,
    subdomain: "acme",
    domain: "acme.brasshr.com",
    website: "https://acme.example",
    industry: "Healthcare",
    company_size: "10-30",
    phone: "5551234567",
    email: "info@acme.com",
    address_line_1: "123 Main St",
    address_line_2: null,
    city: "Los Angeles",
    state: "California",
    postal_code: "90001",
    country: null,
    logo_url: null,
    ein: "12-3456789",
    plan: "starter",
    created_at: null,
    updated_at: null,
  };

  it("falls back to tenant address fields when user profile address is empty", () => {
    expect(resolvePersonalProfileFields(profile, organization)).toMatchObject({
      firstName: "Jane",
      phone: "",
      address: "123 Main St",
      city: "Los Angeles",
      state: "California",
      zipCode: "90001",
      companyEin: "12-3456789",
      companyPhone: "(555) 123-4567",
      companyEmail: "info@acme.com",
      companyWebsite: "https://acme.example",
    });
  });

  it("prefers user profile values over organization values", () => {
    expect(
      resolvePersonalProfileFields(
        {
          ...profile,
          phone: "4445556666",
          address_line1: "9 Admin Way",
          city: "San Diego",
          state: "California",
          zip_code: "92101",
        },
        organization
      )
    ).toMatchObject({
      phone: "(444) 555-6666",
      address: "9 Admin Way",
      city: "San Diego",
      zipCode: "92101",
    });
  });
});
