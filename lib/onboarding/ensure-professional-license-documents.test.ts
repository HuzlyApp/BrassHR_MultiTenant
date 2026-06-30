import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROFESSIONAL_LICENSE_DOCUMENTS,
  ensureProfessionalLicenseRequiredDocuments,
} from "@/lib/onboarding/ensure-professional-license-documents";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

function mockSupabaseForLicenseDocs(existingCount: number) {
  const insert = vi.fn(async () => ({ error: null }));
  const from = vi.fn((table: string) => {
    if (table !== "tenant_required_documents") {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ count: existingCount, error: null })),
      })),
      insert,
    };
  });

  return { supabase: { from } as never, insert };
}

describe("ensureProfessionalLicenseRequiredDocuments", () => {
  const licenseStep: TenantOnboardingStep = {
    id: "step-license-1",
    step_key: "professional_license",
    title: "Professional License",
    description: null,
    step_type: "professional_license",
    sort_order: 20,
    is_required: true,
    is_enabled: true,
    metadata: {},
  };

  it("inserts default slots when a professional license step has none", async () => {
    const { supabase, insert } = mockSupabaseForLicenseDocs(0);

    const changed = await ensureProfessionalLicenseRequiredDocuments(
      supabase,
      "tenant-1",
      [licenseStep]
    );

    expect(changed).toBe(true);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.calls[0]?.[0]).toHaveLength(DEFAULT_PROFESSIONAL_LICENSE_DOCUMENTS.length);
    expect(insert.mock.calls[0]?.[0]?.[0]).toMatchObject({
      tenant_id: "tenant-1",
      onboarding_step_id: "step-license-1",
      title: "Nursing License",
    });
  });

  it("does nothing when requirements already exist", async () => {
    const { supabase, insert } = mockSupabaseForLicenseDocs(2);

    const changed = await ensureProfessionalLicenseRequiredDocuments(
      supabase,
      "tenant-1",
      [licenseStep]
    );

    expect(changed).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
