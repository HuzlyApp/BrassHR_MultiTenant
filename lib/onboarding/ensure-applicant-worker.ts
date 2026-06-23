"use client"

import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview"
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug"

export type EnsureApplicantWorkerResult =
  | { ok: true; workerId?: string; tenantId?: string; created?: boolean }
  | { ok: false; error: string }

/** Creates a `worker` row from parsed resume when profile review was skipped. */
export async function ensureApplicantWorker(): Promise<EnsureApplicantWorkerResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not available during server render." }
  }

  const applicantId = localStorage.getItem("applicantId")?.trim() || ""
  if (!applicantId) {
    return { ok: false, error: "Applicant session not found. Refresh and try again." }
  }
  if (isDraftPreviewApplicantId(applicantId)) {
    return { ok: true }
  }

  const tenantSlug = resolveClientOnboardingTenantSlug(window.location.search)
  if (!tenantSlug) {
    return { ok: false, error: "Company not found. Check the link and try again." }
  }

  let resume: Record<string, unknown> | undefined
  const raw = localStorage.getItem("parsedResume")?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        resume = parsed as Record<string, unknown>
      }
    } catch {
      /* resume optional for ensure */
    }
  }

  const res = await fetch("/api/onboarding/ensure-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicantId, tenantSlug, resume }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    workerId?: string
    tenantId?: string
    created?: boolean
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || "Could not save your profile. Please try again.",
    }
  }

  return {
    ok: true,
    workerId: data.workerId,
    tenantId: data.tenantId,
    created: data.created,
  }
}
