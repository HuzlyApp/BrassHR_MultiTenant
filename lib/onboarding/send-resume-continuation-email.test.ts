import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplatedEmailMock = vi.fn();
const buildApplicantEmailContextMock = vi.fn();
const writeActivityLogMock = vi.fn();

vi.mock("@/lib/email/send-templated-email", () => ({
  sendTemplatedEmail: (...args: unknown[]) => sendTemplatedEmailMock(...args),
}));

vi.mock("@/lib/email/applicant-email-context", () => ({
  buildApplicantEmailContext: (...args: unknown[]) => buildApplicantEmailContextMock(...args),
  contextToTemplateVariables: (ctx: {
    applicantName: string;
    tenantName: string;
    applicantContinuationLink: string;
    supportEmail: string;
  }) => ({
    applicantName: ctx.applicantName,
    tenantName: ctx.tenantName,
    applicantContinuationLink: ctx.applicantContinuationLink,
    supportEmail: ctx.supportEmail,
  }),
}));

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLogMock(...args),
}));

import {
  extractEmailFromResumeText,
  hasResumeContinuationEmailBeenSent,
  resolveResumeContinuationRecipientEmail,
  sendResumeContinuationEmail,
} from "@/lib/onboarding/send-resume-continuation-email";

function makeSupabase(options?: {
  alreadySent?: boolean;
  workerEmail?: string | null;
}) {
  const continuationUpdate = vi.fn(async () => ({ error: null }));
  const continuationQuery = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options?.alreadySent ? { id: "link-1" } : null,
      error: null,
    })),
    update: vi.fn(() => ({ eq: continuationUpdate })),
  };

  const workerQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "worker-1",
        tenant_id: "tenant-1",
        email: options?.workerEmail ?? null,
      },
      error: null,
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "applicant_continuation_links") {
        return {
          select: vi.fn(() => continuationQuery),
          update: continuationQuery.update,
        };
      }
      if (table === "worker") {
        return { select: vi.fn(() => workerQuery) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("resolveResumeContinuationRecipientEmail", () => {
  it("prefers worker email when present", () => {
    expect(
      resolveResumeContinuationRecipientEmail({
        workerEmail: "applicant@example.com",
        extractedText: "other@example.com",
      })
    ).toBe("applicant@example.com");
  });

  it("falls back to parsed resume email", () => {
    expect(
      resolveResumeContinuationRecipientEmail({
        parsedResume: { email: "parsed@example.com" },
      })
    ).toBe("parsed@example.com");
  });

  it("extracts email from resume text", () => {
    expect(
      resolveResumeContinuationRecipientEmail({
        extractedText: "Jane Doe\njane.doe@example.com\nExperience",
      })
    ).toBe("jane.doe@example.com");
  });
});

describe("extractEmailFromResumeText", () => {
  it("returns null when no email is present", () => {
    expect(extractEmailFromResumeText("Jane Doe\nNurse")).toBeNull();
  });
});

describe("hasResumeContinuationEmailBeenSent", () => {
  it("returns true when a sent link exists for the resume", async () => {
    const supabase = makeSupabase({ alreadySent: true });
    await expect(
      hasResumeContinuationEmailBeenSent(supabase as never, "worker-1", "resume-1")
    ).resolves.toBe(true);
  });
});

describe("sendResumeContinuationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendTemplatedEmailMock.mockResolvedValue({ sent: true, messageId: "msg-1" });
    buildApplicantEmailContextMock.mockResolvedValue({
      tenantId: "tenant-1",
      tenantName: "Acme Health",
      applicantName: "Jane Doe",
      applicantEmail: "jane@example.com",
      applicantContinuationLink: "https://tenant.example.com/application/continue?token=abc",
      continuationLinkId: "link-1",
      applicationStatusUrl: "https://tenant.example.com/application/application-status?tenant=acme",
      applicantPortalUrl: "https://tenant.example.com/application/home?tenant=acme",
      supportEmail: "support@acme.com",
    });
  });

  it("skips when continuation email was already sent for this resume", async () => {
    const supabase = makeSupabase({ alreadySent: true });
    const result = await sendResumeContinuationEmail(supabase as never, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      resumeId: "resume-1",
      origin: "https://tenant.example.com",
      trigger: "resume_upload",
      extractedText: "jane@example.com",
    });

    expect(result).toEqual({ outcome: "skipped", reason: "ALREADY_SENT" });
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
    expect(writeActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.resume_continuation_email.skipped" })
    );
  });

  it("sends email with secure continuation link in template variables", async () => {
    const supabase = makeSupabase({ workerEmail: "jane@example.com" });
    const result = await sendResumeContinuationEmail(supabase as never, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      resumeId: "resume-1",
      origin: "https://tenant.example.com",
      trigger: "resume_upload",
      extractedText: "Jane Doe",
    });

    expect(result).toEqual({ outcome: "sent", messageId: "msg-1" });
    expect(buildApplicantEmailContextMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        continuationReason: "resume_continuation",
        markContinuationSent: false,
        recipientEmailOverride: "jane@example.com",
        continuationMetadata: {
          resume_id: "resume-1",
          trigger: "resume_upload",
        },
      })
    );
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        to: "jane@example.com",
        templateKey: "resume_continuation",
        variables: expect.objectContaining({
          applicantContinuationLink:
            "https://tenant.example.com/application/continue?token=abc",
        }),
      })
    );
    expect(writeActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.resume_continuation_email.sent" })
    );
  });

  it("skips when no recipient email can be resolved", async () => {
    const supabase = makeSupabase({ workerEmail: null });
    const result = await sendResumeContinuationEmail(supabase as never, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      resumeId: "resume-1",
      origin: "https://tenant.example.com",
      trigger: "resume_upload",
      extractedText: "Jane Doe only",
    });

    expect(result).toEqual({ outcome: "skipped", reason: "NO_EMAIL" });
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });
});

describe("resume continuation template rendering", () => {
  it("interpolates continuation link into seeded template body", async () => {
    const { interpolateTemplate } = await import("@/lib/email-templates/interpolation");
    const subject = "Complete Your Application";
    const body = `<p>Hello {{applicantName}},</p>
<p><a href="{{applicantContinuationLink}}">Continue Application</a></p>
<p>Thank you,<br>{{tenantName}} Team</p>`;
    const variables = {
      applicantName: "Jane Doe",
      tenantName: "Acme Health",
      applicantContinuationLink: "https://acme.example.com/application/continue?token=secure",
      supportEmail: "support@acme.com",
    };

    expect(interpolateTemplate(subject, variables, { escapeForHtml: false })).toBe(
      "Complete Your Application"
    );
    expect(interpolateTemplate(body, variables, { escapeForHtml: true })).toContain(
      "https://acme.example.com/application/continue?token=secure"
    );
    expect(interpolateTemplate(body, variables, { escapeForHtml: true })).toContain("Jane Doe");
  });
});
