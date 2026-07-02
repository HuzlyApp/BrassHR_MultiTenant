import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplatedEmailMock = vi.fn();

vi.mock("@/lib/email/send-templated-email", () => ({
  sendTemplatedEmail: (...args: unknown[]) => sendTemplatedEmailMock(...args),
}));

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: vi.fn(async () => undefined),
}));

import { sendOwnerOnboardingContinuationEmail } from "@/lib/onboarding/send-owner-onboarding-continuation-email";

function makeSupabase(options?: { alreadySent?: boolean; platformTenantId?: string }) {
  const continuationInsert = vi.fn(async () => ({
    data: { id: "link-1" },
    error: null,
  }));
  const continuationUpdate = vi.fn(async () => ({ error: null }));
  const continuationSelect = {
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options?.alreadySent ? { id: "existing" } : null,
      error: null,
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "owner_onboarding_continuation_links") {
        return {
          select: vi.fn(() => continuationSelect),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: continuationInsert })) })),
          update: vi.fn(() => ({ eq: continuationUpdate })),
        };
      }
      if (table === "tenants") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: options?.platformTenantId
                  ? { id: options.platformTenantId }
                  : { id: "platform-tenant-1" },
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("sendOwnerOnboardingContinuationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendTemplatedEmailMock.mockResolvedValue({ sent: true, messageId: "msg-1" });
  });

  it("skips duplicate initial signup emails", async () => {
    const supabase = makeSupabase({ alreadySent: true });
    const result = await sendOwnerOnboardingContinuationEmail(supabase as never, {
      userId: "user-1",
      email: "owner@example.com",
      tenantAdminName: "Jane Owner",
      origin: "https://brasshr.com",
    });

    expect(result).toEqual({ outcome: "skipped", reason: "ALREADY_SENT" });
    expect(sendTemplatedEmailMock).not.toHaveBeenCalled();
  });

  it("sends email with tenant-aware continuation link", async () => {
    const supabase = makeSupabase();
    const result = await sendOwnerOnboardingContinuationEmail(supabase as never, {
      userId: "user-1",
      email: "owner@example.com",
      tenantAdminName: "Jane Owner",
      origin: "https://brasshr.com",
    });

    expect(result.outcome).toBe("sent");
    expect(sendTemplatedEmailMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        to: "owner@example.com",
        templateKey: "tenant_onboarding_continuation",
        variables: expect.objectContaining({
          tenantAdminName: "Jane Owner",
          tenantEmail: "owner@example.com",
          tenantOnboardingStatusLink: expect.stringContaining(
            "https://brasshr.com/tenant-onboarding/continue?token="
          ),
        }),
      })
    );
  });
});

describe("resolvePostAuthRedirect owner signup", () => {
  it("routes incomplete tenant onboarding to your-trial instead of setup", async () => {
    const { resolvePostAuthRedirect } = await import("@/lib/auth/owner-onboarding-status");
    expect(
      resolvePostAuthRedirect({
        signupCompleted: true,
        tenantOnboardingCompleted: false,
        godAdmin: false,
      })
    ).toBe("/your-trial?account-ready=true");
  });

  it("still honors explicit tenant-onboarding next path", async () => {
    const { resolvePostAuthRedirect } = await import("@/lib/auth/owner-onboarding-status");
    expect(
      resolvePostAuthRedirect(
        {
          signupCompleted: true,
          tenantOnboardingCompleted: false,
          godAdmin: false,
        },
        "/tenant-onboarding"
      )
    ).toBe("/tenant-onboarding");
  });
});

describe("owner continuation token validation", () => {
  it("detects expired links", async () => {
    const { findOwnerContinuationLinkByToken } = await import(
      "@/lib/onboarding/owner-onboarding-continuation-link"
    );

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "link-1",
                user_id: "user-1",
                email: "owner@example.com",
                target_path: "/tenant-onboarding",
                expires_at: new Date(Date.now() - 60_000).toISOString(),
                revoked_at: null,
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    const row = await findOwnerContinuationLinkByToken(supabase as never, "token-value");
    expect(row?.id).toBe("link-1");
    expect(new Date(row!.expires_at).getTime()).toBeLessThan(Date.now());
  });
});

describe("tenant onboarding continuation template", () => {
  it("renders setup link in email body", async () => {
    const { interpolateTemplate } = await import("@/lib/email-templates/interpolation");
    const body = `<p>Hello {{tenantAdminName}},</p><p><a href="{{tenantOnboardingStatusLink}}">Continue BrassHR Setup</a></p>`;
    const link = "https://tenant.example.com/tenant-onboarding/continue?token=abc";
    const html = interpolateTemplate(
      body,
      {
        tenantAdminName: "Jane Owner",
        tenantOnboardingStatusLink: link,
        tenantEmail: "jane@example.com",
        supportEmail: "support@brasshr.com",
      },
      { escapeForHtml: true }
    );
    expect(html).toContain(link);
    expect(html).toContain("Jane Owner");
  });
});
