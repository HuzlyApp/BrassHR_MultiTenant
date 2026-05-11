import type { User } from "@supabase/supabase-js";

/** Required `raw_app_meta_data.platform` / JWT `app_metadata.platform` for this product. */
export const NEXUS_PLATFORM = "nexus";

/**
 * Server + client (after login): respects `PLATFORM_ENFORCE` / `NEXT_PUBLIC_PLATFORM_ENFORCE`, else defaults to enforcing in production.
 */
export function isPlatformEnforcementEnabled(): boolean {
  const v = (
    process.env.PLATFORM_ENFORCE ??
    process.env.NEXT_PUBLIC_PLATFORM_ENFORCE ??
    ""
  )
    .trim()
    .toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function getUserPlatform(user: Pick<User, "app_metadata"> | null | undefined): string | null {
  if (!user?.app_metadata || typeof user.app_metadata !== "object") return null;
  const p = (user.app_metadata as Record<string, unknown>).platform;
  if (typeof p !== "string") return null;
  const t = p.trim().toLowerCase();
  return t || null;
}

export function isNexusPlatformUser(
  user: Pick<User, "app_metadata"> | null | undefined
): boolean {
  return getUserPlatform(user) === NEXUS_PLATFORM;
}

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

export function logAuthDebug(
  phase: string,
  info: {
    userId?: string | null;
    platform?: string | null;
    role?: string | null;
    godAdmin?: boolean | null;
  }
): void {
  if (!AUTH_DEBUG) return;
  // eslint-disable-next-line no-console
  console.info(`[auth-debug] ${phase}`, info);
}
