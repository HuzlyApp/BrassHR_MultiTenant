import type { SupabaseBackendId } from "@/lib/supabase/backend-config";

const BACKEND_HEADER = "x-supabase-backend";

export function getRequestBackendId(headers: Headers): SupabaseBackendId | null {
  const value = headers.get(BACKEND_HEADER)?.trim().toLowerCase();
  if (value === "primary" || value === "fallback") return value;
  return null;
}

export function withRequestBackendHeader(
  headers: Headers,
  backendId: SupabaseBackendId,
): Headers {
  const next = new Headers(headers);
  next.set(BACKEND_HEADER, backendId);
  return next;
}

export const SUPABASE_BACKEND_COOKIE = "sb-backend";

export function getCookieBackendId(cookieValue: string | undefined): SupabaseBackendId | null {
  const value = cookieValue?.trim().toLowerCase();
  if (value === "primary" || value === "fallback") return value;
  return null;
}
