import { describe, expect, it } from "vitest";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";
import { enrichTenantConfigFromPublishedFlow } from "@/lib/onboarding/enrich-config-from-published-flow";
import { getFirmaRecruiterTemplateId } from "@/lib/onboarding/firma-step-settings";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

const TENANT_ID = "9b1b72ab-2d9f-4a2c-9839-bbae260ec15a";

function makeConfig(steps: TenantOnboardingConfig["steps"]): TenantOnboardingConfig {
  return {
    configId: "cfg-test",
    tenantId: TENANT_ID,
    version: 1,
    steps,
    requiredDocuments: [],
    skillAssessments: [],
  };
}

describe("enrichTenantConfigFromPublishedFlow", () => {
  it("overlays Firma settings from published flow when step metadata is empty", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: {
                      builder_draft: {
                        nodes: [
                          {
                            id: "step-agreement_signature",
                            stepId: "employee-agreement",
                            label: "Agreement / Signature",
                            description: "",
                            position: { x: 0, y: 0 },
                            day: 1,
                            required: true,
                            settings: {
                              ...DEFAULT_STEP_SETTINGS,
                              firmaRecruiterTemplateId: "7032efde-bb05-4b92-8776-e62bfbb335df",
                              firmaRecruiterTemplateName: "template example",
                            },
                          },
                        ],
                        edges: [],
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const config = makeConfig([
      {
        id: "step-1",
        step_key: "authorizations",
        title: "Authorizations",
        description: null,
        step_type: "authorizations",
        sort_order: 40,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
    ]);

    const enriched = await enrichTenantConfigFromPublishedFlow(
      supabase as never,
      TENANT_ID,
      config
    );

    const authStep = enriched.steps[0];
    expect(getFirmaRecruiterTemplateId(authStep)).toBe("7032efde-bb05-4b92-8776-e62bfbb335df");
  });

  it("leaves steps unchanged when Firma settings are already present", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const config = makeConfig([
      {
        id: "step-1",
        step_key: "authorizations",
        title: "Authorizations",
        description: null,
        step_type: "authorizations",
        sort_order: 40,
        is_required: true,
        is_enabled: true,
        metadata: {
          workflow_settings: {
            firmaRecruiterTemplateId: "existing-template",
          },
        },
      },
    ]);

    const enriched = await enrichTenantConfigFromPublishedFlow(
      supabase as never,
      TENANT_ID,
      config
    );

    expect(enriched).toBe(config);
    expect(getFirmaRecruiterTemplateId(enriched.steps[0])).toBe("existing-template");
  });
});
