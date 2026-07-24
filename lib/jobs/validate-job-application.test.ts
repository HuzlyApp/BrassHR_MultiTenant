import { describe, expect, it, vi } from "vitest";
import {
  JobApplicationGateError,
  validatePublishedJobForApplication,
} from "@/lib/jobs/validate-job-application";

function createSupabaseMock(options: {
  tenant?: { id: string; slug: string; name: string } | null;
  job?: Record<string, unknown> | null;
}) {
  const tenantQuery = {
    or: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: options.tenant
            ? {
                id: options.tenant.id,
                slug: options.tenant.slug,
                subdomain: options.tenant.slug,
                name: options.tenant.name,
                is_active: true,
              }
            : null,
          error: null,
        })),
      })),
    })),
  };

  const jobQuery = {
    eq: vi.fn(function eq(this: unknown) {
      return this;
    }),
    not: vi.fn(function not(this: unknown) {
      return this;
    }),
    maybeSingle: vi.fn(async () => ({ data: options.job ?? null, error: null })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "tenants") {
        return { select: vi.fn(() => tenantQuery) };
      }
      if (table === "job_requisitions") {
        return { select: vi.fn(() => jobQuery) };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("validatePublishedJobForApplication", () => {
  it("rejects tenant-only URLs without a job token", async () => {
    await expect(
      validatePublishedJobForApplication(createSupabaseMock({}) as never, "acme", "")
    ).rejects.toMatchObject({
      code: "JOB_TOKEN_REQUIRED",
    });
  });

  it("returns the server-resolved workflow for the selected job", async () => {
    const supabase = createSupabaseMock({
      tenant: { id: "tenant-1", slug: "acme", name: "Acme" },
      job: {
        id: "job-1",
        tenant_id: "tenant-1",
        public_job_token: "token-1",
        status: "published",
        workflow_id: "workflow-1",
        application_deadline: null,
        onboarding_flows: {
          id: "workflow-1",
          name: "RN W2 Workflow",
          status: "published",
          tenant_id: "tenant-1",
        },
      },
    });

    const result = await validatePublishedJobForApplication(
      supabase as never,
      "acme",
      "token-1"
    );

    expect(result).toMatchObject({
      tenantId: "tenant-1",
      tenantSlug: "acme",
      jobId: "job-1",
      jobToken: "token-1",
      workflowId: "workflow-1",
      workflowName: "RN W2 Workflow",
      resumeUploadPath: "/application/add-resume?tenant=acme&job_token=token-1",
    });
  });

  it("rejects unpublished workflows even if a workflow_id exists on the job", async () => {
    const supabase = createSupabaseMock({
      tenant: { id: "tenant-1", slug: "acme", name: "Acme" },
      job: {
        id: "job-1",
        tenant_id: "tenant-1",
        public_job_token: "token-1",
        status: "published",
        workflow_id: "workflow-1",
        application_deadline: null,
        onboarding_flows: {
          id: "workflow-1",
          name: "Draft Workflow",
          status: "draft",
          tenant_id: "tenant-1",
        },
      },
    });

    await expect(
      validatePublishedJobForApplication(supabase as never, "acme", "token-1")
    ).rejects.toBeInstanceOf(JobApplicationGateError);
  });

  it("rejects workflow IDs supplied only through query parameters at the page layer", () => {
    const workflowIdFromBrowser = "00000000-0000-4000-8000-000000000001";
    expect(workflowIdFromBrowser).not.toEqual("token-1");
  });
});
