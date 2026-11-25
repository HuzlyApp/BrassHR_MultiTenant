import type { User } from "@supabase/supabase-js";

export const OAUTH_NEXT_COOKIE = "brass_oauth_next";
const OAUTH_NEXT_MAX_AGE_SECONDS = 10 * 60;

/** Allow only same-origin relative paths for OAuth `next` redirects. */
export function sanitizeOAuthNextPath(
  next: string | null | undefined,
  fallback = "/login"
): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Supabase redirect allow-lists match better without query strings.
 * Destination is stored in a short-lived cookie instead.
 */
export function buildGoogleOAuthRedirectTo(origin: string): string {
  return new URL("/auth/callback", origin).toString();
}

export function rememberOAuthNextPath(nextPath: string): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(sanitizeOAuthNextPath(nextPath));
  document.cookie = `${OAUTH_NEXT_COOKIE}=${value}; Path=/; Max-Age=${OAUTH_NEXT_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function readOAuthNextPathFromCookieHeader(
  cookieHeader: string | null | undefined,
  fallback = "/login"
): string {
  if (!cookieHeader) return fallback;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_NEXT_COOKIE}=`));
  if (!match) return fallback;
  const raw = match.slice(OAUTH_NEXT_COOKIE.length + 1);
  try {
    return sanitizeOAuthNextPath(decodeURIComponent(raw), fallback);
  } catch {
    return fallback;
  }
}

export function clearOAuthNextCookieOptions(): {
  name: string;
  value: string;
  options: { path: string; maxAge: number };
} {
  return {
    name: OAUTH_NEXT_COOKIE,
    value: "",
    options: { path: "/", maxAge: 0 },
  };
}

export function userHasGoogleIdentity(
  user: Pick<User, "identities" | "app_metadata"> | null | undefined
): boolean {
  if (!user) return false;
  if (user.identities?.some((identity) => identity.provider === "google")) return true;
  const provider = user.app_metadata?.provider;
  if (provider === "google") return true;
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("google");
}

export function namePartsFromOAuthUser(
  user: Pick<User, "user_metadata" | "email"> | null | undefined
): { firstName: string; lastName: string; email: string } {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const given = String(meta.given_name ?? meta.first_name ?? "").trim();
  const family = String(meta.family_name ?? meta.last_name ?? "").trim();
  const full = String(meta.full_name ?? meta.name ?? "").trim();
  let firstName = given;
  let lastName = family;
  if ((!firstName || !lastName) && full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (!firstName) firstName = parts[0] ?? "";
    if (!lastName) lastName = parts.slice(1).join(" ");
  }
  return {
    firstName,
    lastName,
    email: String(user?.email ?? "")
      .trim()
      .toLowerCase(),
  };
}
