import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

type Body = { tenantId?: string | null };

/**
 * Narrow god-admin recruiter traffic to one tenant (“view-only” impersonation stays app-layer;
 * destructive actions remain governed by RBAC/product rules elsewhere).
 */
export async function POST(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!auth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    typeof body.tenantId === "string" && UUID_RE.test(body.tenantId.trim())
      ? body.tenantId.trim().toLowerCase()
      : null;

  const clearChoice =
    body.tenantId === null || body.tenantId === "" || typeof body.tenantId === "undefined";

  if (clearChoice) {
    const res = NextResponse.json({ ok: true, tenantId: null });
    res.cookies.set(VIEW_AS_TENANT_COOKIE, "", { ...cookieOpts, maxAge: 0 });
    return res;
  }

  if (raw) {
    const res = NextResponse.json({ ok: true, tenantId: raw });
    res.cookies.set(VIEW_AS_TENANT_COOKIE, raw, cookieOpts);
    return res;
  }

  return NextResponse.json({ error: "tenantId must be a UUID or omitted to clear." }, { status: 400 });
}
