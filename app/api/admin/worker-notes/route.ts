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
  };
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }

    const resolved = await resolveWorkerAccess(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const { supabase, workerId } = resolved;
    const notes = await loadWorkerNotesForWorkerId(supabase, workerId);
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[admin/worker-notes GET]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { workerId?: string; body?: string };
    const workerIdRaw = body.workerId?.trim() || "";
    const noteBody = body.body?.trim() || "";

    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }
    if (!noteBody) {
      return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
    }

    const resolved = await resolveWorkerAccess(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const { supabase, workerId, tenantId, userId } = resolved;
    const { data, error } = await supabase
      .from("worker_notes")
      .insert({
        worker_id: workerId,
        tenant_id: tenantId,
        created_by_user_id: userId,
        body: noteBody,
      })
      .select("id, worker_id, tenant_id, body, created_at, updated_at, created_by_user_id")
      .single();

    if (error) throw error;

    const row = data as NoteRow;
    const notes = await loadWorkerNotesForWorkerId(supabase, workerId);
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
