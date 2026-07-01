"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser";
import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isOnboardingDraftPreview,
} from "@/lib/onboarding/is-draft-preview";
import {
  getScopedApplicantId,
  setScopedApplicantId,
} from "@/lib/tenant/scoped-storage";

export type ApplicantBootstrapResult = { applicantId: string } | { error: string };

/**
 * Onboarding persists `worker.user_id` matching applicant auth user id.
 * Uses an isolated Supabase client so recruiter/admin login is never signed out.
 */
export async function ensureApplicantMatchesAuthSession(
  _legacySupabase?: SupabaseClient
): Promise<ApplicantBootstrapResult> {
  void _legacySupabase;

  if (isOnboardingDraftPreview()) {
    return { applicantId: DRAFT_PREVIEW_APPLICANT_ID };
  }

  if (typeof window !== "undefined") {
    try {
      const continuationRes = await fetch("/api/onboarding/continuation-session", {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (continuationRes.ok) {
        const continuation = (await continuationRes.json()) as {
          active?: boolean;
          applicantId?: string;
        };
        const applicantId = continuation.applicantId?.trim();
        if (continuation.active === true && applicantId) {
          setScopedApplicantId(applicantId);
          return { applicantId };
        }
      }
    } catch {
      // Fall through to anonymous applicant session bootstrap.
    }
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
    const prev = getScopedApplicantId();
    if (prev && prev !== uid) {
      console.info("[onboarding] applicantId synced to applicant auth user id", { prev, uid });
    }
    setScopedApplicantId(uid);
  }

  return { applicantId: uid };
}
