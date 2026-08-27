import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  buildWorkflowTestUrl,
  isWorkflowTestSession,
  shouldGateResumeEntryByJobBoard,
  stripJobTokenForWorkflowTest,
} from "./workflow-test-session";
import type { TenantOnboardingConfig } from "./types";

function minimalConfig(steps: TenantOnboardingConfig["steps"]): TenantOnboardingConfig {
  return {
    configId: "cfg-1",
    tenantId: "tenant-1",
    version: 1,
    steps,
    requiredDocuments: [],
    skillAssessments: [],
  };
}

describe("isWorkflowTestSession", () => {
  it("detects preview=draft and mode=test", () => {
    expect(isWorkflowTestSession("?tenant=zipstaff&preview=draft")).toBe(true);
    expect(isWorkflowTestSession("tenant=zipstaff&mode=test")).toBe(true);
    expect(isWorkflowTestSession("?tenant=zipstaff&job_token=abc")).toBe(false);
  });
});

describe("buildWorkflowTestUrl", () => {
  it("opens the first applicant step with preview=draft and without job_token", () => {
    const config = minimalConfig([
      {
        id: "s1",
        step_key: "resume_upload",
        title: "Resume",
        description: null,
        step_type: "resume_upload",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
    ]);

    const url = buildWorkflowTestUrl(config, "zipstaff");
    expect(url).toContain("/application/add-resume");
    expect(url).toContain("tenant=zipstaff");
    expect(url).toContain("preview=draft");
    expect(url).not.toContain("job_token");
  });
});

describe("shouldGateResumeEntryByJobBoard", () => {
  it("does not send Test workflow / draft preview to the jobs board", () => {
    expect(
      shouldGateResumeEntryByJobBoard({
        search: "?tenant=zipstaff&preview=draft",
        jobToken: "",
      })
    ).toBe(false);
    expect(
      shouldGateResumeEntryByJobBoard({
        search: "tenant=zipstaff&mode=test",
        jobToken: "",
      })
    ).toBe(false);
  });

  it("still gates live applicants who landed on add-resume without a job", () => {
    expect(
      shouldGateResumeEntryByJobBoard({
        search: "?tenant=zipstaff",
        jobToken: "",
      })
    ).toBe(true);
  });

  it("does not gate live applicants who already have a job_token", () => {
    expect(
      shouldGateResumeEntryByJobBoard({
        search: "?tenant=zipstaff&job_token=abc",
        jobToken: "abc",
      })
    ).toBe(false);
  });
});

describe("stripJobTokenForWorkflowTest", () => {
  it("removes job_token while keeping other params", () => {
    expect(
      stripJobTokenForWorkflowTest(
        "/application/add-resume?tenant=zipstaff&job_token=secret&preview=draft"
      )
    ).toBe("/application/add-resume?tenant=zipstaff&preview=draft");
  });
});

describe("withTenant in workflow test mode", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store: Record<string, string> = {
      applicationJobToken: "live-job-token",
    };
    vi.stubGlobal("window", {
      location: { search: "?tenant=zipstaff&preview=draft" },
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup jsdom stub
      delete globalThis.window;
    } else {
      vi.stubGlobal("window", originalWindow);
    }
    vi.unstubAllGlobals();
  });

  it("does not attach a live job_token while testing a workflow", async () => {
    const { withTenant, currentApplicationJobToken } = await import("@/lib/tenant/with-tenant");
    expect(currentApplicationJobToken()).toBeNull();
    expect(withTenant("/application/profile-review", "zipstaff")).toBe(
      "/application/profile-review?tenant=zipstaff&preview=draft"
    );
  });
});
