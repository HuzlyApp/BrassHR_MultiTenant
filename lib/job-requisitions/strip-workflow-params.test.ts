import { describe, expect, it } from "vitest";
import { stripUntrustedWorkflowParams } from "@/lib/job-requisitions/resolve-job-application-entry";

describe("stripUntrustedWorkflowParams", () => {
  it("removes workflow override parameters while keeping job/tenant params", () => {
    const input = new URLSearchParams({
      tenant: "acme",
      job_token: "abc",
      workflow_id: "evil",
      workflow_template_id: "evil2",
      onboarding_flow_id: "evil3",
      flow_id: "evil4",
    });
    const cleaned = stripUntrustedWorkflowParams(input);
    expect(cleaned.get("tenant")).toBe("acme");
    expect(cleaned.get("job_token")).toBe("abc");
    expect(cleaned.get("workflow_id")).toBeNull();
    expect(cleaned.get("workflow_template_id")).toBeNull();
    expect(cleaned.get("onboarding_flow_id")).toBeNull();
    expect(cleaned.get("flow_id")).toBeNull();
  });
});
