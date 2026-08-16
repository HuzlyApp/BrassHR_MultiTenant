import { NextResponse } from "next/server";
import type { ApiAuthContext } from "@/lib/auth/api-session";

export function requireWorkflowAdmin(auth: ApiAuthContext): NextResponse | null {
  if (auth.role === "admin" || auth.godAdmin) return null;
  return NextResponse.json(
    { error: "Forbidden", detail: "Administrator role required for workflow configuration" },
    { status: 403 }
  );
}
