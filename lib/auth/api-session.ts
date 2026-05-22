import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { isStaffRole, parseAppRole, type AppRole } from "@/lib/auth/app-role";
import { resolveAppRoleForUser } from "@/lib/auth/resolve-role";
import {
  getUserPlatform,
  isNexusPlatformUser,
  isPlatformEnforcementEnabled,
  jsonUnauthorized,
  logAuthDebug,
} from "@/lib/auth/platform";

const DEV_BYPASS_USER = "00000000-0000-0000-0000-000000000001";

export type ApiAuthContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  godAdmin: boolean;
  /** True only when DEV_ADMIN_AUTH_BYPASS is used (local testing). */
  devBypass: boolean;
};

function isAdminRbacEnforced() {
  return (
    process.env.ADMIN_RBAC_ENFORCE === "true" ||
    process.env.NEXT_PUBLIC_ADMIN_AUTH_REQUIRED === "true"
  );
}

function devBypassAuth(): ApiAuthContext | null {
  if (process.env.NODE_ENV === "production") return null;
  /**
   * Local DX default:
   * - If RBAC is not explicitly enforced, allow recruiter/admin pages and APIs
   *   to function without wiring a full auth+role seed.
   * - You can still force strict behavior by setting ADMIN_RBAC_ENFORCE=true.
   * - Explicit DEV_ADMIN_AUTH_BYPASS=false disables this fallback.
   */
  const bypassFlag = process.env.DEV_ADMIN_AUTH_BYPASS;
  const allowByDefault = !isAdminRbacEnforced();
  const enabled =
    bypassFlag === "true" || (bypassFlag !== "false" && allowByDefault);
  if (!enabled) return null;
  return {
    userId: DEV_BYPASS_USER,
    email: null,
    role: parseAppRole(process.env.DEV_IMPERSONATE_ROLE) ?? "admin",
    godAdmin: false,
    devBypass: true,
  };
}

export type StaffApiAuthContext = ApiAuthContext & {
  authUser: User;
};

async function hasGodAdminDbFlag(userId: string): Promise<boolean> {
  const sb = createServiceRoleClient();
  if (!sb) return false;
  const { data } = await sb.from("users").select("god_admin").eq("id", userId).maybeSingle();
  return (data as { god_admin?: boolean } | null)?.god_admin === true;
}

async function extractBearerToken(): Promise<string | null> {
  const hdrs = await headers();
  const auth = hdrs.get("authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function getSessionUser(): Promise<{ user: User | null; error: unknown }> {
  const supabase = await createClient();
  const first = await supabase.auth.getUser();
  if (first.data.user?.id) {
    return { user: first.data.user, error: first.error };
  }
  const bearer = await extractBearerToken();
  if (!bearer) {
    return { user: null, error: first.error };
  }
  const second = await supabase.auth.getUser(bearer);
  return { user: second.data.user ?? null, error: second.error ?? first.error };
}

/**
 * Cookie session user with Nexus platform (no RBAC). Use in onboarding APIs that only need identity + platform.
 */
export async function requireNexusSessionUser(): Promise<User | NextResponse> {
  const bypass = devBypassAuth();
  if (bypass) {
    console.warn("[auth] DEV_ADMIN_AUTH_BYPASS active — not for production");
    return jsonUnauthorized(401);
  }
  try {
    const { user, error } = await getSessionUser();
    if (error || !user?.id) {
      logAuthDebug("requireNexusSessionUser:no-user", {});
      return jsonUnauthorized(401);
    }
    if (isPlatformEnforcementEnabled() && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      logAuthDebug("requireNexusSessionUser:wrong-platform", {
        userId: user.id,
        platform: getUserPlatform(user),
      });
      return jsonUnauthorized(403);
    }
    logAuthDebug("requireNexusSessionUser:ok", {
      userId: user.id,
      platform: getUserPlatform(user),
    });
    return user;
  } catch (e) {
    console.error("[auth] requireNexusSessionUser", e);
    return jsonUnauthorized(401);
  }
}

/**
 * Authenticated Supabase user for Route Handlers. Returns 401/403 JSON if unauthenticated or wrong platform.
 * In development, optional `DEV_ADMIN_AUTH_BYPASS=true` yields a synthetic admin (see `.env.example`).
 */
export async function requireApiSession(): Promise<ApiAuthContext | NextResponse> {
  try {
    const { user, error } = await getSessionUser();
    if (error || !user?.id) {
      const bypass = devBypassAuth();
      if (bypass) {
        console.warn("[auth] DEV_ADMIN_AUTH_BYPASS active — not for production");
        return bypass;
      }
      logAuthDebug("requireApiSession:no-user", {});
      return jsonUnauthorized(401);
    }
    if (isPlatformEnforcementEnabled() && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      logAuthDebug("requireApiSession:wrong-platform", {
        userId: user.id,
        platform: getUserPlatform(user),
      });
      return jsonUnauthorized(403);
    }
    const role = await resolveAppRoleForUser(user);
    const godAdmin = isGodAdminUser(user) || (await hasGodAdminDbFlag(user.id));
    logAuthDebug("requireApiSession:ok", {
      userId: user.id,
      platform: getUserPlatform(user),
      role,
    });
    return {
      userId: user.id,
      email: typeof user.email === "string" ? user.email : null,
      role,
      godAdmin,
      devBypass: false,
    };
  } catch (e) {
    console.error("[auth] requireApiSession", e);
    return jsonUnauthorized(401);
  }
}

export function requireRole(ctx: ApiAuthContext, allowed: AppRole[]): NextResponse | null {
  if (allowed.includes(ctx.role)) return null;
  return NextResponse.json({ error: "Forbidden", detail: "Insufficient role" }, { status: 403 });
}

/** Recruiter, support, or admin — pipeline / roster APIs. */
export async function requireStaffApiSession(): Promise<StaffApiAuthContext | NextResponse> {
  try {
    const { user, error } = await getSessionUser();
    if (error || !user?.id) {
      const bypass = devBypassAuth();
      if (bypass) {
        console.warn("[auth] DEV_ADMIN_AUTH_BYPASS active — not for production");
        return {
          ...bypass,
          authUser: {
            id: bypass.userId,
            email: bypass.email ?? undefined,
            app_metadata: {},
          } as unknown as User,
        };
      }
      logAuthDebug("requireStaffApiSession:no-user", {});
      return jsonUnauthorized(401);
    }
    if (isPlatformEnforcementEnabled() && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      logAuthDebug("requireStaffApiSession:wrong-platform", {
        userId: user.id,
        platform: getUserPlatform(user),
      });
      return jsonUnauthorized(403);
    }

    const role = await resolveAppRoleForUser(user);
    const godAdmin = isGodAdminUser(user) || (await hasGodAdminDbFlag(user.id));
    const ctx: ApiAuthContext = {
      userId: user.id,
      email: typeof user.email === "string" ? user.email : null,
      role,
      godAdmin,
      devBypass: false,
    };

    if (!isStaffRole(role) && !godAdmin) {
      return NextResponse.json({ error: "Forbidden", detail: "Staff role required" }, { status: 403 });
    }

    logAuthDebug("requireStaffApiSession:ok", {
      userId: user.id,
      platform: getUserPlatform(user),
      role,
      godAdmin,
    });

    return { ...ctx, authUser: user };
  } catch (e) {
    console.error("[auth] requireStaffApiSession", e);
    return jsonUnauthorized(401);
  }
}
