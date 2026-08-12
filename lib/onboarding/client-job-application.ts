"use client";

import { applicationPath, currentOnboardingTenantSlug } from "@/lib/tenant/with-tenant";

const JOB_APPLICATION_ID_KEY = "jobApplicationId";
const APPLICATION_JOB_TOKEN_KEY = "applicationJobToken";

export function readJobApplicationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JOB_APPLICATION_ID_KEY)?.trim() || null;
}

export function persistJobApplicationId(applicationId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const value = applicationId?.trim();
  if (value) {
    localStorage.setItem(JOB_APPLICATION_ID_KEY, value);
  }
}

export function persistApplicationJobContext(input: {
  applicationId?: string | null;
  jobToken?: string | null;
}): void {
  persistJobApplicationId(input.applicationId);
  if (typeof window === "undefined") return;
  const jobToken = input.jobToken?.trim();
  if (jobToken) {
    localStorage.setItem(APPLICATION_JOB_TOKEN_KEY, jobToken);
  }
}

export async function ensureJobApplicationForCurrentJob(input: {
  applicantId: string;
  tenantSlug: string;
  jobToken: string;
}): Promise<{ applicationId?: string; alreadySubmitted?: boolean; error?: string }> {
  const applicantId = input.applicantId.trim();
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  const jobToken = input.jobToken.trim();
  if (!applicantId || !tenantSlug || !jobToken) {
    return { error: "Missing applicant, tenant, or job context." };
  }

  try {
    const res = await fetch("/api/onboarding/job-application/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicantId,
        tenantSlug,
        jobToken,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      applicationId?: string;
      alreadySubmitted?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { error: payload.error || "Could not start job application." };
    }
    if (payload.alreadySubmitted) {
      return {
        applicationId: payload.applicationId,
        alreadySubmitted: true,
      };
    }
    if (payload.applicationId) {
      persistJobApplicationId(payload.applicationId);
    }
    return { applicationId: payload.applicationId, alreadySubmitted: false };
  } catch {
    return { error: "Could not start job application." };
  }
}

export function jobsListingHref(tenantSlug?: string | null): string {
  const slug =
    tenantSlug?.trim().toLowerCase() ||
    (typeof window !== "undefined" ? currentOnboardingTenantSlug() : null);
  if (slug) {
    return applicationPath(`/jobs?tenant=${encodeURIComponent(slug)}`, slug);
  }
  return "/jobs";
}
