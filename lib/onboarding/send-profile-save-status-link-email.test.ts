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
    statusLink: ctx.applicantContinuationLink,
    supportEmail: ctx.supportEmail,
  }),
}));

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLogMock(...args),
}));

import {
  PROFILE_STATUS_LINK_DEDUP_MS,
  sendProfileSaveStatusLinkEmail,
  shouldSkipProfileStatusLinkResend,
} from "@/lib/onboarding/send-profile-save-status-link-email";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";

const continuationLink =
  "https://tenant.example.com/application/continue?token=abc";

function makeSupabase(options?: {
  statusLinkSentAt?: string | null;
  statusLinkEmail?: string | null;
  tenantId?: string;
}) {
  const workerUpdateEq = vi.fn(async () => ({ error: null }));
  const workerUpdate = vi.fn(() => ({ eq: workerUpdateEq }));
  const continuationUpdateEq = vi.fn(async () => ({ error: null }));

  const workerQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "worker-1",
        tenant_id: options?.tenantId ?? "tenant-1",
        status_link_sent_at: options?.statusLinkSentAt ?? null,
        status_link_email: options?.statusLinkEmail ?? null,
      },
      error: null,
    })),
    update: workerUpdate,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "worker") {
        return {
          select: vi.fn(() => workerQuery),
          update: workerQuery.update,
        };
      }
      if (table === "applicant_continuation_links") {
        return {
          update: vi.fn(() => ({ eq: continuationUpdateEq })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    _workerUpdateEq: workerUpdateEq,
    _continuationUpdateEq: continuationUpdateEq,
  };
}

describe("shouldSkipProfileStatusLinkResend", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");

  it("skips when the same email was sent recently", () => {
    const sentAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(
      shouldSkipProfileStatusLinkResend({
        lastSentAt: sentAt,
        lastSentEmail: "jane@example.com",
        recipientEmail: "jane@example.com",
        now,
      })
    ).toEqual({ skip: true, reason: "ALREADY_SENT_RECENTLY" });
  });

  it("does not skip when recipient email changed", () => {
    const sentAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(
      shouldSkipProfileStatusLinkResend({
        lastSentAt: sentAt,
        lastSentEmail: "old@example.com",
        recipientEmail: "new@example.com",
        now,
      })
    ).toEqual({ skip: false });
  });

  it("does not skip when dedup window elapsed", () => {
    const sentAt = new Date(now.getTime() - PROFILE_STATUS_LINK_DEDUP_MS - 1000).toISOString();
    expect(
      shouldSkipProfileStatusLinkResend({
        lastSentAt: sentAt,
        lastSentEmail: "jane@example.com",
        recipientEmail: "jane@example.com",
        now,
      })
    ).toEqual({ skip: false });
  });
});

describe("sendProfileSaveStatusLinkEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendTemplatedEmailMock.mockResolvedValue({ sent: true, messageId: "msg-1" });
    buildApplicantEmailContextMock.mockResolvedValue({
      tenantId: "tenant-1",
      tenantName: "Acme Health",
      applicantName: "Jane Doe",
      applicantEmail: "jane@example.com",
      applicantContinuationLink: continuationLink,
      continuationLinkId: "link-1",
      applicationStatusUrl:
        "https://tenant.example.com/application/application-status?tenant=acme",
      applicantPortalUrl: "https://tenant.example.com/application/home?tenant=acme",
      supportEmail: "support@acme.com",
    });
  });

  it("sends status link email after profile save", async () => {
    const supabase = makeSupabase();
    const result = await sendProfileSaveStatusLinkEmail(supabase as never, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      recipientEmail: "jane@example.com",
      origin: "https://tenant.example.com",
    });

    expect(result).toEqual({ outcome: "sent", messageId: "msg-1" });
    expect(buildApplicantEmailContextMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        continuationReason: "application_status",
        recipientEmailOverride: "jane@example.com",
        markContinuationSent: false,
        continuationMetadata: {
          trigger: "profile_save",
          recipient_email: "jane@example.com",
        },
      })
    );
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        to: "jane@example.com",
        templateKey: EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS,
        variables: expect.objectContaining({
          statusLink: continuationLink,
          applicantContinuationLink: continuationLink,
        }),
      })
    );
    expect(writeActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.profile_status_link_email.sent" })
    );
    expect(supabase._workerUpdateEq).toHaveBeenCalledWith("id", "worker-1");
  });

  it("skips duplicate sends for the same email within the dedup window", async () => {
    const now = new Date("2026-07-03T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const supabase = makeSupabase({
        statusLinkSentAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        statusLinkEmail: "jane@example.com",
      });

      const result = await sendProfileSaveStatusLinkEmail(supabase as never, {
        workerId: "worker-1",
        tenantId: "tenant-1",
        recipientEmail: "jane@example.com",
        origin: "https://tenant.example.com",
      });

      expect(result).toEqual({ outcome: "skipped", reason: "ALREADY_SENT_RECENTLY" });
      expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
      expect(writeActivityLogMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "onboarding.profile_status_link_email.skipped" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("resends when applicant changed email before saving", async () => {
    const now = new Date("2026-07-03T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const supabase = makeSupabase({
        statusLinkSentAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        statusLinkEmail: "old@example.com",
      });

      const result = await sendProfileSaveStatusLinkEmail(supabase as never, {
        workerId: "worker-1",
        tenantId: "tenant-1",
        recipientEmail: "new@example.com",
        origin: "https://tenant.example.com",
      });

      expect(result).toEqual({ outcome: "sent", messageId: "msg-1" });
      expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
        supabase,
        expect.objectContaining({ to: "new@example.com" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns failed without throwing when email send fails", async () => {
    sendTemplatedEmailMock.mockRejectedValue(new Error("SMTP down"));
    const supabase = makeSupabase();

    const result = await sendProfileSaveStatusLinkEmail(supabase as never, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      recipientEmail: "jane@example.com",
      origin: "https://tenant.example.com",
    });

    expect(result.outcome).toBe("failed");
    expect(result.reason).toBe("SMTP down");
    expect(writeActivityLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding.profile_status_link_email.failed" })
    );
    expect(supabase._workerUpdateEq).toHaveBeenCalledWith("id", "worker-1");
  });
});
