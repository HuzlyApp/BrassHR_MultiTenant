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
  const token = await getStaffAccessToken();
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
