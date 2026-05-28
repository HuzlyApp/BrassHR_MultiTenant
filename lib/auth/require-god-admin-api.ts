import { NextResponse } from "next/server";
import {
  requireStaffApiSession,
  type StaffApiAuthContext,
} from "@/lib/auth/api-session";

export type GodAdminApiContext = StaffApiAuthContext;

/** Staff session that is exclusively platform god admin (JWT or users.god_admin). */
export async function requireGodAdminApiSession(): Promise<GodAdminApiContext | NextResponse> {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  if (auth.devBypass) {
    return NextResponse.json(
      { error: "Forbidden", detail: "God Admin APIs are disabled in dev bypass mode." },
      { status: 403 }
    );
  }

  if (!auth.godAdmin) {
    return NextResponse.json(
      { error: "Forbidden", detail: "God Admin role required." },
      { status: 403 }
    );
  }

  return auth;
}
