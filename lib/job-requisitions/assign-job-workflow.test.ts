import { describe, expect, it } from "vitest";
import { buildJobWorkflowPatch } from "@/lib/job-requisitions/assign-job-workflow";

describe("buildJobWorkflowPatch", () => {
  it("blocks publish when mapping is missing", () => {
    const patch = buildJobWorkflowPatch(
      {
        ok: false,
        error: "missing mapping",
        configPath: "/admin",
        match: { workflowTemplateId: "", mappingId: null, matchLevel: "none", priority: -1 },
      },
      null,
      "Open"
    );
    expect(patch.workflow_template_id).toBeNull();
    expect(patch.workflow_assignment_error).toContain("missing");
    expect(patch.public_job_token).toBeNull();
  });

  it("assigns workflow and token when publish succeeds", () => {
    const patch = buildJobWorkflowPatch(
      {
        ok: true,
        workflowTemplateId: "flow-1",
        publicJobToken: "token-abc",
        match: {
          workflowTemplateId: "flow-1",
          mappingId: "map-1",
          matchLevel: "exact",
          priority: 100,
        },
      },
      null,
      "Open"
    );
    expect(patch.workflow_template_id).toBe("flow-1");
    expect(patch.public_job_token).toBe("token-abc");
    expect(patch.workflow_assignment_error).toBeNull();
  });
});
