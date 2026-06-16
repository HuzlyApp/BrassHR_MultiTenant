import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { workerDisplayName } from "@/lib/messaging/group-conversations";
import { type WorkerSummary } from "@/lib/messaging/staff-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadGroupContext(groupId: string) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = getServiceClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }) };
  }

  const scope = await resolveStaffTenantScope(auth.authUser);
  const groupRes = await supabase
    .from("groups")
    .select("id, tenant_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (groupRes.error) throw groupRes.error;
  if (!groupRes.data) {
    return { error: NextResponse.json({ error: "Group not found" }, { status: 404 }) };
  }
  if (scope.mode === "scoped" && scope.tenantId !== groupRes.data.tenant_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, group: groupRes.data };
}

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupContext(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const membersRes = await resolved.supabase
      .from("group_members")
      .select("id, group_id, tenant_id, user_id, user_name, joined_at")
      .eq("group_id", resolved.group.id)
      .order("joined_at", { ascending: true });
    if (membersRes.error) throw membersRes.error;

    return NextResponse.json({ members: membersRes.data ?? [] });
  } catch (error) {
    console.error("[admin/messages/groups/:id/members:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupContext(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const body = (await req.json().catch(() => ({}))) as { workerIds?: string[] };
    const workerIds = Array.from(new Set((body.workerIds ?? []).map((id) => id.trim()).filter(Boolean)));
    if (workerIds.length === 0) {
      return NextResponse.json({ error: "Select at least one worker." }, { status: 400 });
    }

    const existingRes = await resolved.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", resolved.group.id);
    if (existingRes.error) throw existingRes.error;

    const existingIds = new Set((existingRes.data ?? []).map((row) => String(row.user_id)));
    const newWorkerIds = workerIds.filter((id) => !existingIds.has(id));
    if (newWorkerIds.length === 0) {
      return NextResponse.json({ error: "Selected workers are already in this group." }, { status: 400 });
    }

    const workersRes = await resolved.supabase
      .from("worker")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", resolved.group.tenant_id)
      .in("id", newWorkerIds);
    if (workersRes.error) throw workersRes.error;

    const workers = (workersRes.data ?? []) as WorkerSummary[];
    if (workers.length !== newWorkerIds.length) {
      return NextResponse.json({ error: "One or more workers were not found." }, { status: 400 });
    }

    const insertRes = await resolved.supabase
      .from("group_members")
      .insert(
        workers.map((worker) => ({
          tenant_id: resolved.group.tenant_id,
          group_id: resolved.group.id,
          user_id: worker.id,
          user_name: workerDisplayName(worker),
        }))
      )
      .select("id, group_id, tenant_id, user_id, user_name, joined_at");
    if (insertRes.error) throw insertRes.error;

    return NextResponse.json({ ok: true, members: insertRes.data ?? [] });
  } catch (error) {
    console.error("[admin/messages/groups/:id/members:post]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add members" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() ?? "";
    const workerCheck = parseRequiredUuid(workerIdRaw, "workerId");
    if (!workerCheck.ok) return NextResponse.json({ error: workerCheck.error }, { status: 400 });

    const resolved = await loadGroupContext(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const { error } = await resolved.supabase
      .from("group_members")
      .delete()
      .eq("group_id", resolved.group.id)
      .eq("user_id", workerCheck.value);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/messages/groups/:id/members:delete]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}
