import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { loadWorkerNotesForWorkerId } from "@/lib/worker-notes";

export const runtime = "nodejs";

type NoteRow = {
  id: string;
  worker_id: string;
  tenant_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
};

async function resolveWorkerAccess(workerIdRaw: string) {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) };
  }

  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }),
    };
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id")
    .eq("id", idCheck.value)
    .maybeSingle();

  if (error) throw error;
  if (!worker?.id || !worker.tenant_id) {
    return { error: NextResponse.json({ error: "Worker not found" }, { status: 404 }) };
  }

  if (!(await canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id }))) {
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
  };
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    const applicationId = req.nextUrl.searchParams.get("applicationId")?.trim() || null;
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }

    const resolved = await resolveWorkerAccess(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const { supabase, workerId } = resolved;
    const notes = await loadWorkerNotesForWorkerId(supabase, workerId, {
      applicationId,
    });
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[admin/worker-notes GET]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      workerId?: string;
      body?: string;
      applicationId?: string;
    };
    const workerIdRaw = body.workerId?.trim() || "";
    const noteBody = body.body?.trim() || "";
    const applicationIdRaw = body.applicationId?.trim() || null;

    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }
    if (!noteBody) {
      return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
    }

    const resolved = await resolveWorkerAccess(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const { supabase, workerId, tenantId, userId } = resolved;

    const { resolveApplicationContextForWorker } = await import(
      "@/lib/jobs/resolve-application-context"
    );
    const ctx = await resolveApplicationContextForWorker({
      supabase,
      tenantId,
      workerId,
      applicationId: applicationIdRaw,
    });
    if (applicationIdRaw && !ctx.applicationId) {
      return NextResponse.json({ error: "Application not found for this worker" }, { status: 404 });
    }
    if (ctx.ambiguous && !ctx.applicationId) {
      return NextResponse.json(
        { error: "applicationId is required when the worker has multiple applications" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("worker_notes")
      .insert({
        worker_id: workerId,
        tenant_id: tenantId,
        created_by_user_id: userId,
        body: noteBody,
        application_id: ctx.applicationId,
      })
      .select("id, worker_id, tenant_id, body, created_at, updated_at, created_by_user_id")
      .single();

    if (error) throw error;

    const row = data as NoteRow;
    const notes = await loadWorkerNotesForWorkerId(supabase, workerId, {
      applicationId: ctx.applicationId,
    });
    const saved = notes.find((note) => note.id === row.id);

    return NextResponse.json({
      note: saved ?? {
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        author_name: "Recruiter",
      },
    });
  } catch (err) {
    console.error("[admin/worker-notes POST]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function mutateNote(req: NextRequest, remove: boolean) {
  try {
    const input = await req.json().catch(() => null) as { workerId?: unknown; noteId?: unknown; body?: unknown } | null;
    const noteId = parseRequiredUuid(typeof input?.noteId === "string" ? input.noteId : "", "noteId");
    if (!noteId.ok) return NextResponse.json({ error: noteId.error }, { status: 400 });
    const noteBody = typeof input?.body === "string" ? input.body.trim() : "";
    if (!remove && !noteBody) return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
    const resolved = await resolveWorkerAccess(typeof input?.workerId === "string" ? input.workerId : "");
    if ("error" in resolved && resolved.error) return resolved.error;
    const query = remove
      ? resolved.supabase.from("worker_notes").delete()
      : resolved.supabase.from("worker_notes").update({ body: noteBody, updated_at: new Date().toISOString() });
    const { data, error } = await query.eq("tenant_id", resolved.tenantId).eq("worker_id", resolved.workerId)
      .eq("id", noteId.value).select("id, body").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    return NextResponse.json({ ok: true, note: data });
  } catch (error) {
    console.error("[admin/worker-notes mutation]", error);
    return NextResponse.json({ error: "Could not update note. Please try again." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) { return mutateNote(req, false); }
export async function DELETE(req: NextRequest) { return mutateNote(req, true); }
