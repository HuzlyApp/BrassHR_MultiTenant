import { describe, expect, it, vi } from "vitest";
import {
  buildFirmaFieldPrefillOverrides,
  buildFirmaRecipientPrefillPayload,
  buildFirmaSigningAddressPrefill,
  EMPTY_FIRMA_SIGNING_PREFILL,
  formatFirmaSigningFullAddress,
  formatFirmaSigningPayFrequency,
  formatFirmaSigningPayRate,
  resolveFirmaSigningJobTitle,
  resolveFirmaSigningPrefillValues,
} from "@/lib/onboarding/firma-signing-prefill";

describe("firma signing prefill helpers", () => {
  it("formats a full address from parts including line 2 and country", () => {
    expect(
      formatFirmaSigningFullAddress({
        streetAddress: "123 Main St",
        addressLine2: "Apt 4",
        city: "Austin",
        stateProvince: "TX",
        postalCode: "78701",
        country: "US",
      })
    ).toBe("123 Main St, Apt 4, Austin, TX 78701, US");
  });

  it("keeps address line 1 and 2 separate", () => {
    const built = buildFirmaSigningAddressPrefill({
      address1: "123 Main St",
      address2: "Suite 200",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    });
    expect(built.streetAddress).toBe("123 Main St");
    expect(built.addressLine2).toBe("Suite 200");
    expect(built.fullAddress).toBe("123 Main St, Suite 200, Austin, TX 78701, US");
  });

  it("ignores placeholder dash address segments", () => {
    const built = buildFirmaSigningAddressPrefill({
      address1: "-",
      address2: "-",
      city: "Austin",
      state: "TX",
      zip: "78701",
    });
    expect(built.streetAddress).toBeNull();
    expect(built.addressLine2).toBeNull();
    expect(built.fullAddress).toBe("Austin, TX 78701");
  });

  it("formats pay rate and frequency from job columns", () => {
    expect(
      formatFirmaSigningPayRate({
        pay_rate_min: 56,
        pay_rate_max: 58,
      })
    ).toBe("$56.00 – $58.00");
    expect(formatFirmaSigningPayFrequency({ pay_rate_period: "Hour" })).toBe("Hourly");
    expect(formatFirmaSigningPayFrequency({ compensation_type: "Annually" })).toBe("Annually");
  });

  it("builds Firma recipient standard + custom_fields from table-backed prefill", () => {
    const payload = buildFirmaRecipientPrefillPayload({
      ...EMPTY_FIRMA_SIGNING_PREFILL,
      streetAddress: "123 Main St",
      addressLine2: "Apt 4",
      city: "Austin",
      stateProvince: "TX",
      postalCode: "78701",
      country: "US",
      fullAddress: "123 Main St, Apt 4, Austin, TX 78701, US",
      jobTitle: "Registered Nurse",
      employmentType: "W2",
      startDate: "2026-12-01",
      payRate: "$56.00 – $58.00",
      payFrequency: "Hourly",
      managerName: "Alex Manager",
      phone: "5125551212",
      dateOfBirth: "1990-05-01",
      ssnLastFour: "6789",
    });

    expect(payload).toMatchObject({
      title: "Registered Nurse",
      phone_number: "5125551212",
      street_address: "123 Main St",
      city: "Austin",
      state_province: "TX",
      postal_code: "78701",
      country: "US",
      custom_fields: {
        job_title: "Registered Nurse",
        position_title: "Registered Nurse",
        candidate_address: "123 Main St, Apt 4, Austin, TX 78701, US",
        address_line_2: "Apt 4",
        date_of_birth: "1990-05-01",
        ssn_last_four: "6789",
        employment_type: "W2",
        start_date: "2026-12-01",
        hire_date: "2026-12-01",
        pay_rate: "$56.00 – $58.00",
        compensation: "$56.00 – $58.00",
        pay_frequency: "Hourly",
        manager_name: "Alex Manager",
        hiring_manager_name: "Alex Manager",
      },
    });
  });

  it("builds read-only field overrides for mapped template variables", () => {
    const overrides = buildFirmaFieldPrefillOverrides(
      [
        { variable_name: "candidate_address", app_data_source: "candidate_address" },
        { variable_name: "job_title", app_data_source: "position_title", firma_field_id: "fld-1" },
        { variable_name: "dob", app_data_source: "date_of_birth" },
        { variable_name: "ssn4", app_data_source: "ssn_last_four" },
        { variable_name: "pay", app_data_source: "pay_rate" },
        { variable_name: "unused", app_data_source: "recruiter_name" },
      ],
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        prefill: {
          ...EMPTY_FIRMA_SIGNING_PREFILL,
          streetAddress: "123 Main St",
          city: "Austin",
          stateProvince: "TX",
          postalCode: "78701",
          country: "US",
          fullAddress: "123 Main St, Austin, TX 78701, US",
          jobTitle: "Registered Nurse",
          dateOfBirth: "1990-05-01",
          ssnLastFour: "6789",
          payRate: "$56.00",
        },
      }
    );

    expect(overrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable_name: "candidate_address",
          read_only_value: "123 Main St, Austin, TX 78701, US",
        }),
        expect.objectContaining({
          template_field_id: "fld-1",
          variable_name: "job_title",
          read_only_value: "Registered Nurse",
        }),
        expect.objectContaining({ variable_name: "dob", read_only_value: "1990-05-01" }),
        expect.objectContaining({ variable_name: "ssn4", read_only_value: "6789" }),
        expect.objectContaining({ variable_name: "pay", read_only_value: "$56.00" }),
      ])
    );
    expect(overrides.find((row) => row.variable_name === "unused")).toBeUndefined();
  });

  it("resolves job title from job_applications → job_requisitions", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "job_applications") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { job_requisition_id: "job-1", applicant_profile_id: null },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "job_requisitions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      public_title: "Travel ICU RN",
                      source_job_title: "ICU RN",
                      employment_type: "W2",
                      target_start_date: "2026-12-01",
                      pay_rate: 56,
                      pay_rate_min: null,
                      pay_rate_max: null,
                      pay_rate_period: "Hour",
                      rate_unit: null,
                      compensation_type: null,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    await expect(
      resolveFirmaSigningJobTitle(supabase as never, "tenant-1", "app-1")
    ).resolves.toBe("Travel ICU RN");
  });

  it("keeps seeded address/job title when table lookups fail", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("lookup unavailable");
      }),
    };

    const values = await resolveFirmaSigningPrefillValues(supabase as never, {
      tenantId: "tenant-1",
      workerId: "worker-1",
      applicationId: "app-1",
      address: {
        streetAddress: "9 Seed Lane",
        city: "Dallas",
        stateProvince: "TX",
        postalCode: "75001",
      },
      jobTitle: "Seeded Title",
    });

    expect(values).toMatchObject({
      streetAddress: "9 Seed Lane",
      city: "Dallas",
      stateProvince: "TX",
      postalCode: "75001",
      jobTitle: "Seeded Title",
    });
  });
});
