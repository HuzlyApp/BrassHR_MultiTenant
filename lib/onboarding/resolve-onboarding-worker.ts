import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveOrEnsureWorkerForApplicant,
  resolveTenantIdBySlug,
  resolveWorkerByApplicantId,
  type WorkerContext,
} from "@/lib/onboarding/resolve-worker-context";
import { onboardingSlugFromRequestCookies } from "@/lib/tenant/onboarding-slug-from-cookie";

/** Resolve the worker row for onboarding uploads, preferring the active tenant subdomain. */
export async function resolveOnboardingWorker(
  supabase: SupabaseClient,
  applicantId: string,
  tenantSlug?: string | null
): Promise<WorkerContext | null> {
  const slug = tenantSlug?.trim().toLowerCase() || "";
  if (slug) {
    const tenantId = await resolveTenantIdBySlug(supabase, slug);
    if (tenantId) {
      const scoped = await resolveWorkerByApplicantId(supabase, applicantId, tenantId);
      if (scoped) return scoped;
      return resolveOrEnsureWorkerForApplicant(supabase, applicantId, slug);
    }
  }

  return resolveWorkerByApplicantId(supabase, applicantId);
}

export function readOnboardingTenantSlugFromRequest(
  req: Request,
  formData?: FormData | null
): string | null {
  const fromForm = formData?.get("tenantSlug");
  if (typeof fromForm === "string" && fromForm.trim().length >= 2) {
    return fromForm.trim().toLowerCase();
  }

  const fromCookie = onboardingSlugFromRequestCookies(req);
  if (fromCookie) return fromCookie;

  try {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("slug") ?? url.searchParams.get("tenant");
    if (fromQuery && fromQuery.trim().length >= 2) {
      return fromQuery.trim().toLowerCase();
    }
  } catch {
    /* noop */
  }

  return null;
}
