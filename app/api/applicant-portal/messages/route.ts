import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByUserId, normalizeApplicantStatus } from "@/lib/applicant-portal";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type MessageRow = {
  id: string;
  sender_role: "applicant" | "recruiter";
  body: string;
  created_at: string;
};

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveApplicantRequest(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role not configured");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  const applicant = await findApplicantByUserId(supabase, data.user.id);
  if (!applicant?.id || normalizeApplicantStatus(applicant.status) !== "approved") return null;

  return { supabase, workerId: applicant.id, tenantId: applicant.tenant_id, userId: data.user.id };
}

async function resolveStaffRequest(req: NextRequest, workerIdRaw: string) {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) };

  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }) };
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id, email, first_name, last_name")
    .eq("id", idCheck.value)
    .maybeSingle();
  if (error) throw error;
  if (!worker?.id || !worker.tenant_id) {
    return { error: NextResponse.json({ error: "Worker not found" }, { status: 404 }) };
  }
  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const tenantId = String(worker.tenant_id);
  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    supabase,
    workerId: String(worker.id),
    tenantId,
    userId: auth.devBypass ? null : auth.userId,
    applicant: worker,
  };
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() ?? "";
    const resolved = workerIdRaw
      ? await resolveStaffRequest(req, workerIdRaw)
      : await resolveApplicantRequest(req);

    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    const { data, error } = await resolved.supabase
      .from("applicant_messages")
      .select("id, sender_role, body, created_at")
      .eq("worker_id", resolved.workerId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ messages: (data as MessageRow[] | null) ?? [] });
  } catch (err) {
    console.error("[applicant-portal/messages:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { body?: string; workerId?: string };
    const message = body.body?.trim() ?? "";
    if (!message) return NextResponse.json({ error: "Enter a message." }, { status: 400 });

    const workerIdRaw = body.workerId?.trim() ?? "";
    const resolved = workerIdRaw
      ? await resolveStaffRequest(req, workerIdRaw)
      : await resolveApplicantRequest(req);

    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    const senderRole = workerIdRaw ? "recruiter" : "applicant";
    const { data, error } = await resolved.supabase
      .from("applicant_messages")
      .insert({
        tenant_id: resolved.tenantId,
        worker_id: resolved.workerId,
        sender_role: senderRole,
        sender_user_id: resolved.userId,
        body: message,
      })
      .select("id, sender_role, body, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, message: data as MessageRow });
  } catch (err) {
    console.error("[applicant-portal/messages:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
