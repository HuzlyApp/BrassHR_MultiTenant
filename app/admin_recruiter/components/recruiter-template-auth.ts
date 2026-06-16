"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

export async function recruiterTemplateAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function recruiterTemplateFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const auth = await recruiterTemplateAuthHeaders();
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value as string);
  }
  return fetch(input, { ...init, headers, cache: "no-store" });
}
