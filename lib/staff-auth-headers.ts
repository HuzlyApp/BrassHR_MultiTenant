"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

let inflightAccessToken: Promise<string | null> | null = null;

/** One shared getSession call when many API requests start at once. */
async function getStaffAccessToken(): Promise<string | null> {
  if (inflightAccessToken) return inflightAccessToken;

  inflightAccessToken = supabaseBrowser.auth
    .getSession()
    .then(({ data: { session } }) => session?.access_token ?? null)
    .catch(() => null)
    .finally(() => {
      inflightAccessToken = null;
    });

  return inflightAccessToken;
}

export async function staffAuthHeaders(): Promise<HeadersInit> {
  // Keep bearer auth when available. A stalled browser SDK must not indefinitely
  // block the existing cookie fallback; the server still verifies the session.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    getStaffAccessToken(),
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function staffFetchInit(extraHeaders?: HeadersInit): Promise<RequestInit> {
  return {
    credentials: "include",
    headers: {
      ...(await staffAuthHeaders()),
      ...extraHeaders,
    },
  };
}
