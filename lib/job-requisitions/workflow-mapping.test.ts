import { describe, expect, it } from "vitest";
import {
  computeMappingPriority,
  resolveWorkflowMappingFromRows,
} from "@/lib/job-requisitions/resolve-workflow-mapping";
import type { WorkflowMappingRow } from "@/lib/job-requisitions/types";
import { hashResumeFile } from "@/lib/resume/resume-parsing-persistence";

const tenantId = "11111111-1111-4111-8111-111111111111";
const flowA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const flowB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const flowDefault = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function mapping(
  partial: Partial<WorkflowMappingRow> & Pick<WorkflowMappingRow, "workflow_template_id">
): WorkflowMappingRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    tenant_id: tenantId,
    job_role: partial.job_role ?? null,
    employment_type: partial.employment_type ?? null,
    placement_type: partial.placement_type ?? null,
    workflow_template_id: partial.workflow_template_id,
    priority: partial.priority ?? 50,
    is_active: partial.is_active ?? true,
  };
}

describe("resolveWorkflowMappingFromRows", () => {
  const attrs = {
    tenantId,
    jobRole: "RN",
    employmentType: "W2" as const,
    placementType: "Internal" as const,
  };

  it("picks exact mapping match", () => {
    const result = resolveWorkflowMappingFromRows(
      [
        mapping({ job_role: "RN", employment_type: "W2", placement_type: "Internal", workflow_template_id: flowA, priority: 100 }),
        mapping({ job_role: "RN", workflow_template_id: flowB, priority: 50 }),
      ],
      attrs,
      flowDefault
    );
    expect(result.workflowTemplateId).toBe(flowA);
    expect(result.matchLevel).toBe("exact");
  });

  it("falls back to role + employment mapping", () => {
    const result = resolveWorkflowMappingFromRows(
      [
        mapping({ job_role: "RN", employment_type: "W2", workflow_template_id: flowB, priority: 75 }),
        mapping({ job_role: "RN", workflow_template_id: flowA, priority: 50 }),
      ],
      attrs,
      flowDefault
    );
    expect(result.workflowTemplateId).toBe(flowB);
    expect(result.matchLevel).toBe("role_employment");
  });

  it("uses tenant default when no mapping matches", () => {
    const result = resolveWorkflowMappingFromRows(
      [mapping({ job_role: "LPN", workflow_template_id: flowA })],
      attrs,
      flowDefault
    );
    expect(result.workflowTemplateId).toBe(flowDefault);
    expect(result.matchLevel).toBe("tenant_default");
  });

  it("returns none when mapping and default are missing", () => {
    const result = resolveWorkflowMappingFromRows([], attrs, null);
    expect(result.matchLevel).toBe("none");
    expect(result.workflowTemplateId).toBe("");
  });

  it("ignores disabled mappings", () => {
    const result = resolveWorkflowMappingFromRows(
      [
        mapping({
          job_role: "RN",
          employment_type: "W2",
          placement_type: "Internal",
          workflow_template_id: flowA,
          is_active: false,
        }),
      ],
      attrs,
      flowDefault
    );
    expect(result.workflowTemplateId).toBe(flowDefault);
  });
});

describe("computeMappingPriority", () => {
  it("assigns highest priority to exact combinations", () => {
    expect(
      computeMappingPriority({
        jobRole: "RN",
        employmentType: "W2",
        placementType: "Internal",
      })
    ).toBe(100);
  });
});

describe("hashResumeFile", () => {
  it("returns stable hashes for identical buffers", () => {
    const buffer = Buffer.from("same resume bytes");
    expect(hashResumeFile(buffer)).toBe(hashResumeFile(Buffer.from("same resume bytes")));
  });

  it("changes when file content changes", () => {
    expect(hashResumeFile(Buffer.from("resume-a"))).not.toBe(hashResumeFile(Buffer.from("resume-b")));
  });
});
