import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findOwnerContinuationLinkByToken } from "@/lib/onboarding/owner-onboarding-continuation-link";
import { OWNER_ONBOARDING_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { writeActivityLog } from "@/lib/audit/activity-log";

export const runtime = "nodejs";

const CONTINUATION_COOKIE_MAX_AGE_SECONDS = 72 * 60 * 60;

function errorRedirect(req: NextRequest, code: "missing" | "invalid" | "expired" | "revoked"): NextResponse {
  const url = new URL("/tenant-onboarding/link-error", req.url);
  url.searchParams.set("code", code);
  return NextResponse.redirect(url);
}

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || "";
  if (!token) return errorRedirect(req, "missing");

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return errorRedirect(req, "invalid");

  const supabase = createClient(url, key);
  let linkRow;
  try {
    linkRow = await findOwnerContinuationLinkByToken(supabase, token);
  } catch (e) {
    console.error("[tenant-onboarding/continue] lookup failed", e);
    return errorRedirect(req, "invalid");
  }

  if (!linkRow) {
    await writeActivityLog({
      actorUserId: null,
      action: "owner.signup_continuation_link.invalid",
      entityType: "user",
      metadata: { reason: "not_found" },
      request: req,
    });
    return errorRedirect(req, "invalid");
  }

  if (linkRow.revoked_at) {
    await writeActivityLog({
      actorUserId: linkRow.user_id,
      action: "owner.signup_continuation_link.invalid",
      entityType: "user",
      entityId: linkRow.user_id,
      metadata: { reason: "revoked", link_id: linkRow.id },
      request: req,
    });
    return errorRedirect(req, "revoked");
  }

  if (new Date(linkRow.expires_at).getTime() <= Date.now()) {
    await writeActivityLog({
      actorUserId: linkRow.user_id,
      action: "owner.signup_continuation_link.expired",
      entityType: "user",
      entityId: linkRow.user_id,
      metadata: { link_id: linkRow.id },
      request: req,
    });
    return errorRedirect(req, "expired");
  }

  await supabase
    .from("owner_onboarding_continuation_links")
    .update({
      opened_at: new Date().toISOString(),
      last_opened_ip: clientIp(req),
      last_opened_user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .eq("id", linkRow.id);

  await writeActivityLog({
    actorUserId: linkRow.user_id,
    action: "owner.signup_continuation_link.validated",
    entityType: "user",
    entityId: linkRow.user_id,
    metadata: { link_id: linkRow.id, email: linkRow.email },
    request: req,
  });

  const destination = new URL(linkRow.target_path, req.url);
  destination.searchParams.delete("token");

  const res = NextResponse.redirect(destination);
  res.cookies.set(OWNER_ONBOARDING_CONTINUATION_SESSION_COOKIE, linkRow.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CONTINUATION_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
