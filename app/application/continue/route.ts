import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashContinuationToken } from "@/lib/onboarding/applicant-continuation-link";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { APPLICANT_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

type LinkRow = {
  id: string;
  tenant_id: string;
  worker_id: string;
  applicant_user_id: string | null;
  target_path: string;
  expires_at: string;
  revoked_at: string | null;
  completed_at: string | null;
};

function invalidRedirect(req: NextRequest, code: string): NextResponse {
  const url = new URL("/application/add-resume", req.url);
  url.searchParams.set("resume_link_error", code);
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
  if (!token) return invalidRedirect(req, "missing");

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return invalidRedirect(req, "not_configured");

  const supabase = createClient(url, key);
  const tokenHash = hashContinuationToken(token);
  const { data: link, error } = await supabase
    .from("applicant_continuation_links")
    .select("id, tenant_id, worker_id, applicant_user_id, target_path, expires_at, revoked_at, completed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const linkRow = link as LinkRow | null;
  if (error || !linkRow) return invalidRedirect(req, "invalid");
  if (linkRow.revoked_at || linkRow.completed_at) return invalidRedirect(req, "used");
  if (new Date(linkRow.expires_at).getTime() <= Date.now()) return invalidRedirect(req, "expired");

  if (linkRow.applicant_user_id) {
    const ctx = await resolveWorkerByApplicantId(supabase, linkRow.applicant_user_id);
    if (!ctx || ctx.workerId !== linkRow.worker_id || ctx.tenantId !== linkRow.tenant_id) {
      return invalidRedirect(req, "invalid");
    }
  }

  await supabase
    .from("applicant_continuation_links")
    .update({
      opened_at: new Date().toISOString(),
      last_opened_ip: clientIp(req),
      last_opened_user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .eq("id", linkRow.id)
    .is("revoked_at", null);

  const destination = new URL(linkRow.target_path, req.url);
  destination.searchParams.delete("token");
  destination.searchParams.set("resume", "1");

  const res = NextResponse.redirect(destination);
  res.cookies.set(APPLICANT_CONTINUATION_SESSION_COOKIE, linkRow.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}
