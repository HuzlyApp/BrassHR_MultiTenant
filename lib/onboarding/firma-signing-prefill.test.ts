import { describe, expect, it, vi } from "vitest";
import {
  buildFirmaFieldPrefillOverrides,
  buildFirmaRecipientPrefillPayload,
  buildFirmaSigningAddressPrefill,
  formatFirmaSigningFullAddress,
  resolveFirmaSigningJobTitle,
  resolveFirmaSigningPrefillValues,
} from "@/lib/onboarding/firma-signing-prefill";

describe("firma signing prefill helpers", () => {
  it("formats a full address from parts", () => {
    expect(
      formatFirmaSigningFullAddress({
        streetAddress: "123 Main St",
        city: "Austin",
        stateProvince: "TX",
        postalCode: "78701",
      })
    ).toBe("123 Main St, Austin, TX 78701");
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
    expect(built.fullAddress).toBe("Austin, TX 78701");
  });

  it("builds Firma recipient title/address and custom_fields", () => {
    const payload = buildFirmaRecipientPrefillPayload({
      streetAddress: "123 Main St",
      city: "Austin",
      stateProvince: "TX",
      postalCode: "78701",
      fullAddress: "123 Main St, Austin, TX 78701",
      jobTitle: "Registered Nurse",
    });

    expect(payload).toMatchObject({
      title: "Registered Nurse",
      street_address: "123 Main St",
      city: "Austin",
      state_province: "TX",
      postal_code: "78701",
      custom_fields: {
        job_title: "Registered Nurse",
        position_title: "Registered Nurse",
        candidate_address: "123 Main St, Austin, TX 78701",
      },
    });
  });

  it("builds read-only field overrides for mapped template variables", () => {
    const overrides = buildFirmaFieldPrefillOverrides(
      [
        { variable_name: "candidate_address", app_data_source: "candidate_address" },
        { variable_name: "job_title", app_data_source: "position_title", firma_field_id: "fld-1" },
        { variable_name: "unused", app_data_source: "compensation" },
      ],
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        prefill: {
          streetAddress: "123 Main St",
          city: "Austin",
          stateProvince: "TX",
          postalCode: "78701",
          fullAddress: "123 Main St, Austin, TX 78701",
          jobTitle: "Registered Nurse",
        },
      }
    );

    expect(overrides).toEqual([
      {
        variable_name: "candidate_address",
        read_only: true,
        read_only_value: "123 Main St, Austin, TX 78701",
      },
      {
        template_field_id: "fld-1",
        variable_name: "job_title",
        read_only: true,
        read_only_value: "Registered Nurse",
      },
    ]);
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
                    data: { job_requisition_id: "job-1" },
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
      fullAddress: "9 Seed Lane, Dallas, TX 75001",
      jobTitle: "Seeded Title",
    });
  });
});
