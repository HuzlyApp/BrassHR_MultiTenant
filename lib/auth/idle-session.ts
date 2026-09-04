/** Cookie storing last user-activity timestamp (unix ms). Readable by client + middleware. */
export const IDLE_SESSION_COOKIE = "brasshr_last_activity";

/** Sign out after this much time with no user interaction. */
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** How often the client may rewrite the activity cookie while the user is active. */
export const IDLE_ACTIVITY_THROTTLE_MS = 30_000;

/** How often the client re-checks idle expiry while a tab is open. */
export const IDLE_CHECK_INTERVAL_MS = 30_000;

export function parseLastActivityMs(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Returns true when a recorded activity timestamp is older than the idle window.
 * Missing / invalid timestamps are not treated as expired (bootstrap on first paint).
 */
export function isIdleSessionExpired(
  lastActivityMs: number | null,
  nowMs: number = Date.now()
): boolean {
  if (lastActivityMs == null) return false;
  return nowMs - lastActivityMs > IDLE_TIMEOUT_MS;
}

export function idleSessionCookieOptions(maxAgeSeconds: number = Math.ceil(IDLE_TIMEOUT_MS / 1000) + 60 * 60) {
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: maxAgeSeconds,
  };
}

/** Login / sign-in destinations after an idle logout. */
export function idleLogoutRedirectPath(pathname: string): string {
  if (
    pathname.startsWith("/application") ||
    pathname === "/worker-onboarding" ||
    pathname.startsWith("/worker-signin")
  ) {
    return "/worker-signin?error=idle";
  }
  if (pathname.startsWith("/godadmin")) {
    return "/admin?error=idle";
  }
  return "/admin?error=idle";
}
