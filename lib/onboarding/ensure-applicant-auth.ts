"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

export type ApplicantBootstrapResult = { applicantId: string } | { error: string }

/**
 * Onboarding persists `worker.user_id` matching `auth.users.id`. Anonymous applicants must use
 * Supabase Anonymous Sign-In (dashboard: Authentication → Providers → Anonymous users).
 */
export async function ensureApplicantMatchesAuthSession(
  supabase: SupabaseClient
): Promise<ApplicantBootstrapResult> {
  const auth = supabase.auth as typeof supabase.auth & {
    signInAnonymously?: () => Promise<{
      data: { session: { user: { id: string; is_anonymous?: boolean } } | null }
      error: Error | null
    }>
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const existing = sessionData.session?.user

  // Recruiter/staff logins must not reuse their auth user as applicantId.
  if (existing && existing.is_anonymous !== true) {
    await supabase.auth.signOut()
  }

  const { data: afterSignOut } = await supabase.auth.getSession()
  let uid = afterSignOut.session?.user?.id ?? null

  if (!uid) {
    if (typeof auth.signInAnonymously !== "function") {
      return {
        error:
          "Anonymous sign-in is not available on this Supabase client. Upgrade @supabase/supabase-js and enable Anonymous Sign-in in Dashboard → Authentication → Providers.",
      }
    }

    const { data: anon, error } = await auth.signInAnonymously()
    if (error) {
      return { error: error.message }
    }
    uid = anon.session?.user?.id ?? null
    if (!uid) {
      return { error: "Anonymous sign-in succeeded but returned no user id." }
    }
  }

  if (typeof window !== "undefined") {
    const prev = localStorage.getItem("applicantId")?.trim()
    if (prev && prev !== uid) {
      console.info("[onboarding] applicantId synced to Supabase Auth user id (was orphaned uuid)", {
        prev,
      })
    }
    localStorage.setItem("applicantId", uid)
  }

  return { applicantId: uid }
}
