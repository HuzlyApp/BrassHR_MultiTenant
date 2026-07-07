import type { NextRequest } from "next/server";
import { OWNER_TRIAL_PREPARATION_SESSION_COOKIE } from "@/lib/tenant/constants";

/** Edge-safe cookie presence check for middleware (full HMAC verify runs in Node API routes). */
export function hasOwnerTrialPreparationCookie(request: NextRequest): boolean {
  const value = request.cookies.get(OWNER_TRIAL_PREPARATION_SESSION_COOKIE)?.value?.trim();
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  return dot > 0 && dot < value.length - 1;
}
