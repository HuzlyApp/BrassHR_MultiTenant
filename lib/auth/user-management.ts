import { NextResponse } from "next/server";
import type { ApiAuthContext } from "@/lib/auth/api-session";

/** Tenant admin (or platform god admin) may manage staff users and invitations. */
export function canManageStaffUsers(auth: Pick<ApiAuthContext, "role" | "godAdmin">): boolean {
  return auth.role === "admin" || auth.godAdmin === true;
}

export function requireUserManagement(auth: ApiAuthContext): NextResponse | null {
  if (canManageStaffUsers(auth)) return null;
  return NextResponse.json(
    { error: "Forbidden", detail: "Administrator role required to manage users" },
    { status: 403 }
  );
}
