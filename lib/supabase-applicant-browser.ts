"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

/** Separate from recruiter/admin `supabaseBrowser` so applicant preview never replaces staff login. */
const APPLICANT_AUTH_STORAGE_KEY = "brasshr-applicant-auth";

let applicantClient: SupabaseClient | undefined;

export function getApplicantSupabaseClient(): SupabaseClient {
  if (!applicantClient) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key) {
      throw new Error(
        "Missing Supabase URL or anon key (NEXT_PUBLIC_* or EXPO_PUBLIC_* in .env.local)"
      );
    }
    applicantClient = createClient(url, key, {
      auth: {
        storageKey: APPLICANT_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    applicantClient.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.access_token && typeof window !== "undefined") {
        void fetch("/api/onboarding/session", {
          method: "POST", headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => undefined);
      }
    });
  }
  return applicantClient;
}
