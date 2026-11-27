"use client";

import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSession } from "@/lib/auth/browser-session";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isPortalRole } from "@/lib/auth/app-role";
import { setAuthenticatedApplicantClient, getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser";
import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isOnboardingDraftPreview,
} from "@/lib/onboarding/is-draft-preview";
import {
  clearScopedApplicantId,
  getScopedApplicantId,
  setScopedApplicantId,
} from "@/lib/tenant/scoped-storage";
import { candidateSignInHref } from "@/lib/auth/worker-sign-in";

export type ApplicantBootstrapResult =
  | { applicantId: string }
  | {
      error: string;
      reason?: string;
      signInHref?: string;
      ownerEmail?: string | null;
    };

function readUrlApplicationContext(): {
  applicationId: string;
  jobToken: string;
  tenantSlug: string;
} {
  if (typeof window === "undefined") {
    return { applicationId: "", jobToken: "", tenantSlug: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    applicationId: params.get("applicationId")?.trim() || "",
    jobToken: params.get("job_token")?.trim() || params.get("jobToken")?.trim() || "",
    tenantSlug: resolveTenantSlugForClient(window.location.search, { path: window.location.pathname }).slug || "",
  };
}

/**
 * Onboarding persists `worker.user_id` matching applicant auth user id.
 * Uses an isolated Supabase client so recruiter/admin login is never signed out.
 */
async function bootstrapApplicantSession(
  _legacySupabase?: SupabaseClient
): Promise<ApplicantBootstrapResult> {
  void _legacySupabase;

  if (isOnboardingDraftPreview()) {
    return { applicantId: DRAFT_PREVIEW_APPLICANT_ID };
  }

  const portalSession = await getBrowserSession();
  if (portalSession && !portalSession.user.is_anonymous && isPortalRole(portalSession.user.app_metadata?.role)) {
    setAuthenticatedApplicantClient(supabaseBrowser);
  }
  const supabase = getApplicantSupabaseClient();
  const auth = supabase.auth as typeof supabase.auth & {
    signInAnonymously?: () => Promise<{
      data: { session: { user: { id: string; is_anonymous?: boolean } } | null };
      error: Error | null;
    }>;
  };

  const { data: sessionData } = await supabase.auth.getSession();
  let uid = sessionData.session?.user?.id ?? null;

  if (!uid) {
    if (typeof auth.signInAnonymously !== "function") {
      return {
        error:
          "Anonymous sign-in is not available. Enable Anonymous Sign-in in Supabase Dashboard → Authentication → Providers.",
      };
    }

    const { data: anon, error } = await auth.signInAnonymously();
    if (error) {
      return { error: error.message };
    }
    uid = anon.session?.user?.id ?? null;
    if (!uid) {
      return { error: "Anonymous sign-in succeeded but returned no user id." };
    }
  }

  if (typeof window !== "undefined") {
    const { data: current } = await supabase.auth.getSession();
    const token = current.session?.access_token;
    if (!token) return { error: "Applicant session expired. Please refresh." };
    const response = await fetch("/api/onboarding/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: readUrlApplicationContext().tenantSlug, jobToken: readUrlApplicationContext().jobToken || undefined }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return { error: payload.error || "Could not verify applicant session. Please refresh.", reason: payload.reason, signInHref: candidateSignInHref({ tenant: readUrlApplicationContext().tenantSlug || null }) };
    }
    const prev = getScopedApplicantId();
    if (prev && prev !== uid) {
      console.info("[onboarding] applicantId synced to applicant auth user id", { prev, uid });
    }
    setScopedApplicantId(uid);

    // When the URL targets a specific application, ensure this browser session owns it.
    // Stale anonymous sessions from an earlier visit cause progress/step 403s.
    const { applicationId, jobToken, tenantSlug } = readUrlApplicationContext();
    if (applicationId) {
      try {
        const claimRes = await fetch("/api/onboarding/claim-application-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            applicationId,
            jobToken: jobToken || undefined,
            tenantSlug: tenantSlug || undefined,
          }),
          credentials: "include",
        });

        if (!claimRes.ok) {
          const json = (await claimRes.json().catch(() => ({}))) as {
            reason?: string;
            message?: string;
            ownerEmail?: string | null;
            signInHref?: string;
          };

          if (json.reason === "application_ownership" || claimRes.status === 403) {
            const isAnonymous = current.session?.user?.is_anonymous === true;
            if (isAnonymous) {
              await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
              clearScopedApplicantId();
            }

            const emailHint = json.ownerEmail ? ` (${json.ownerEmail})` : "";
            const signInHref =
              json.signInHref || candidateSignInHref({ tenant: tenantSlug || null });
            return {
              error:
                json.message ||
                `This application was started in a different browser session${emailHint}. Sign in with the email used on your application to continue.`,
              reason: "application_ownership",
              signInHref,
              ownerEmail: json.ownerEmail ?? null,
            };
          }
        }
      } catch {
        // Soft-fail: progress APIs will still enforce ownership.
      }
    }
  }

  return { applicantId: uid };
}

let bootstrapPromise: Promise<ApplicantBootstrapResult> | null = null;
export function ensureApplicantMatchesAuthSession(legacySupabase?: SupabaseClient): Promise<ApplicantBootstrapResult> {
  if (!bootstrapPromise) bootstrapPromise = bootstrapApplicantSession(legacySupabase).finally(() => { bootstrapPromise = null; });
  return bootstrapPromise;
}
