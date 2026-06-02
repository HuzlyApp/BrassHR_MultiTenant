import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { APPLICANT_CONTINUATION_SESSION_COOKIE } from "@/lib/tenant/constants";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

type LinkRow = {
  id: string;
  worker_id: string;
  tenant_id: string;
  applicant_user_id: string | null;
  expires_at: string;
  revoked_at: string | null;
  completed_at: string | null;
};

export async function GET(req: NextRequest) {
  const linkId = req.cookies.get(APPLICANT_CONTINUATION_SESSION_COOKIE)?.value?.trim();
  if (!linkId) {
    return NextResponse.json({ active: false });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ active: false, error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data: link, error } = await supabase
    .from("applicant_continuation_links")
    .select("id, worker_id, tenant_id, applicant_user_id, expires_at, revoked_at, completed_at")
    .eq("id", linkId)
    .maybeSingle();

  const linkRow = link as LinkRow | null;
  if (error || !linkRow) {
    const res = NextResponse.json({ active: false });
    res.cookies.delete(APPLICANT_CONTINUATION_SESSION_COOKIE);
    return res;
  }

  const expired = new Date(linkRow.expires_at).getTime() <= Date.now();
  if (expired || linkRow.revoked_at || linkRow.completed_at) {
    const res = NextResponse.json({ active: false });
    res.cookies.delete(APPLICANT_CONTINUATION_SESSION_COOKIE);
    return res;
  }

  let applicantId = linkRow.applicant_user_id;
  if (!applicantId) {
    const { data: worker } = await supabase
      .from("worker")
      .select("user_id")
      .eq("id", linkRow.worker_id)
      .maybeSingle();
    applicantId = (worker as { user_id: string | null } | null)?.user_id ?? null;
  }
  if (!applicantId) {
    return NextResponse.json({ active: false, error: "Applicant session is missing" }, { status: 404 });
  }

  return NextResponse.json({
    active: true,
    applicantId,
    workerId: linkRow.worker_id,
    tenantId: linkRow.tenant_id,
    linkId: linkRow.id,
  });
}

export async function POST(req: NextRequest) {
  const linkId = req.cookies.get(APPLICANT_CONTINUATION_SESSION_COOKIE)?.value?.trim();
  if (!linkId) return NextResponse.json({ ok: true, completed: false });

  const body = (await req.json().catch(() => ({}))) as { completed?: boolean };
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  if (body.completed === true) {
    const supabase = createClient(url, key);
    await supabase
      .from("applicant_continuation_links")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", linkId)
      .is("completed_at", null);
  }

  const res = NextResponse.json({ ok: true, completed: body.completed === true });
  res.cookies.delete(APPLICANT_CONTINUATION_SESSION_COOKIE);
  return res;
}
