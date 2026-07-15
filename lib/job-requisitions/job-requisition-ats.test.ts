import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  assertJobStatusTransition,
  canTransitionJobStatus,
  jobAcceptsApplications,
} from "@/lib/job-requisitions/status-transitions";
import {
  deriveSourceType,
  isValidSourceUrl,
  sanitizeConditionalJobFields,
  validateJobRequisition,
} from "@/lib/job-requisitions/validate-job";
import {
  hasPrivateLeak,
  redactPrivateJobFields,
  toPublicJobPayload,
} from "@/lib/job-requisitions/public-job";
import {
  isPayrollWorkerOutcome,
  resolveConversionOutcome,
} from "@/lib/job-requisitions/convert-disposition";
import { remainingPositions } from "@/lib/job-requisitions/types";
import {
  computeMappingPriority,
  mappingSpecificity,
  resolveWorkflowMappingFromRows,
} from "@/lib/job-requisitions/resolve-workflow-mapping";
import type { WorkflowMappingRow } from "@/lib/job-requisitions/types";

describe("job status transitions", () => {
  it("allows Draft → Published", () => {
    expect(canTransitionJobStatus("Draft", "Published")).toBe(true);
  });

  it("rejects Published → Draft", () => {
    const result = assertJobStatusTransition("Published", "Draft");
    expect(result.ok).toBe(false);
  });

  it("treats Open as Published for applications", () => {
    expect(jobAcceptsApplications("Open")).toBe(true);
    expect(jobAcceptsApplications("Published")).toBe(true);
    expect(jobAcceptsApplications("Paused")).toBe(false);
    expect(jobAcceptsApplications("Draft")).toBe(false);
  });

  it("lists next statuses for Draft", () => {
    expect(allowedNextStatuses("Draft")).toContain("Published");
    expect(allowedNextStatuses("Draft")).toContain("Pending_Approval");
  });
});

describe("conditional MSP / EOR validation", () => {
  it("requires MSP fields at publish", () => {
    const result = validateJobRequisition({
      title: "RN Night",
      employmentType: "W2",
      placementType: "Recruit_and_EOR",
      sourceType: "MSP",
      profession: "RN",
      forPublish: true,
      workflowTemplateId: "flow-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.issues.map((i) => i.field);
      expect(fields).toContain("mspId");
      expect(fields).toContain("externalReqId");
      expect(fields).toContain("eorTenantId");
    }
  });

  it("allows incomplete MSP draft", () => {
    const result = validateJobRequisition({
      title: "RN Night",
      employmentType: "W2",
      placementType: "Recruit_and_Release",
      sourceType: "MSP",
      profession: "RN",
      forPublish: false,
    });
    expect(result.ok).toBe(true);
  });

  it("clears stale MSP and EOR fields when switching to Internal", () => {
    const sanitized = sanitizeConditionalJobFields({
      sourceType: "Internal",
      placementType: "Internal",
      locationType: "Remote",
      mspId: "msp-1",
      mspName: "Acme MSP",
      externalReqId: "EXT-1",
      eorTenantId: "eor-1",
      addressLine1: "123 Main",
    });
    expect(sanitized.msp_id).toBeNull();
    expect(sanitized.external_req_id).toBeNull();
    expect(sanitized.eor_tenant_id).toBeNull();
    expect(sanitized.address_line1).toBeNull();
  });

  it("validates source URL format optionally", () => {
    expect(isValidSourceUrl("")).toBe(true);
    expect(isValidSourceUrl("https://example.com/job/1")).toBe(true);
    expect(isValidSourceUrl("not-a-url")).toBe(false);
  });

  it("derives source type from placement", () => {
    expect(deriveSourceType("Internal")).toBe("Internal");
    expect(deriveSourceType("Recruit_and_EOR")).toBe("MSP");
  });
});

describe("conversion outcomes", () => {
  it("maps placement types to outcomes", () => {
    expect(resolveConversionOutcome("Internal")).toBe("internal_worker");
    expect(resolveConversionOutcome("Recruit_and_EOR")).toBe("eor_worker");
    expect(resolveConversionOutcome("Recruit_and_Release")).toBe("hired_by_client");
  });

  it("identifies payroll outcomes", () => {
    expect(isPayrollWorkerOutcome("internal_worker")).toBe(true);
    expect(isPayrollWorkerOutcome("eor_worker")).toBe(true);
    expect(isPayrollWorkerOutcome("hired_by_client")).toBe(false);
  });
});

describe("public field redaction", () => {
  it("never exposes bill rate or internal notes", () => {
    const publicJob = toPublicJobPayload({
      id: "1",
      job_number: "JOB-2026-000001",
      title: "RN",
      bill_rate: 75,
      pay_rate: 45,
      pay_rate_public: true,
      internal_notes: "secret",
      employment_type: "W2",
    });
    expect(publicJob.payRate).toBe(45);
    expect((publicJob as Record<string, unknown>).bill_rate).toBeUndefined();
    expect(hasPrivateLeak(publicJob as unknown as Record<string, unknown>)).toEqual([]);
  });

  it("redacts private keys from arbitrary rows", () => {
    const redacted = redactPrivateJobFields({
      title: "RN",
      bill_rate: 90,
      msp_name: "MSP",
      description: "Public desc",
    });
    expect(redacted.title).toBe("RN");
    expect(redacted.description).toBe("Public desc");
    expect(redacted.bill_rate).toBeUndefined();
    expect(redacted.msp_name).toBeUndefined();
  });
});

describe("position counts", () => {
  it("computes remaining positions", () => {
    expect(remainingPositions(3, 1)).toBe(2);
    expect(remainingPositions(2, 2)).toBe(0);
    expect(remainingPositions(1, 5)).toBe(0);
  });
});

describe("workflow mapping precedence with specialty", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const flowExact = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const flowBroad = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function mapping(
    partial: Partial<WorkflowMappingRow> & Pick<WorkflowMappingRow, "workflow_template_id">
  ): WorkflowMappingRow {
    return {
      id: partial.id ?? crypto.randomUUID(),
      tenant_id: tenantId,
      job_role: partial.job_role ?? null,
      profession: partial.profession ?? partial.job_role ?? null,
      specialty: partial.specialty ?? null,
      employment_type: partial.employment_type ?? null,
      placement_type: partial.placement_type ?? null,
      source_type: partial.source_type ?? null,
      workflow_template_id: partial.workflow_template_id,
      priority: partial.priority ?? 50,
      is_active: partial.is_active ?? true,
    };
  }

  it("prefers more specific profession+specialty+employment+placement+source", () => {
    const result = resolveWorkflowMappingFromRows(
      [
        mapping({
          profession: "RN",
          specialty: "ICU",
          employment_type: "W2",
          placement_type: "Internal",
          source_type: "Internal",
          workflow_template_id: flowExact,
          priority: 10,
        }),
        mapping({
          profession: "RN",
          workflow_template_id: flowBroad,
          priority: 100,
        }),
      ],
      {
        tenantId,
        jobRole: "RN",
        profession: "RN",
        specialty: "ICU",
        employmentType: "W2",
        placementType: "Internal",
        sourceType: "Internal",
      },
      null
    );
    expect(result.workflowTemplateId).toBe(flowExact);
    expect(result.specificity).toBeGreaterThan(mappingSpecificity(mapping({ profession: "RN", workflow_template_id: flowBroad })));
  });

  it("computes priority for specialty mappings", () => {
    expect(
      computeMappingPriority({
        profession: "RN",
        specialty: "ICU",
        employmentType: "W2",
        placementType: "Internal",
        sourceType: "Internal",
      })
    ).toBe(100);
  });
});
