import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentWrite } from "@/lib/departments/api-context";
import { setDepartmentAssignment } from "@/lib/departments/service";
import type { DepartmentAssignmentKind } from "@/lib/departments/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const resolved = await requireDepartmentWrite();
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    targetId?: string;
    assigned?: boolean;
  };

  const kind: DepartmentAssignmentKind | null =
    body.kind === "job" || body.kind === "candidate" ? body.kind : null;
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!kind || !targetId || typeof body.assigned !== "boolean") {
    return NextResponse.json({ error: "Choose a job or candidate to update." }, { status: 400 });
  }

  try {
    await setDepartmentAssignment(resolved.supabase, resolved.tenantId, id, kind, targetId, body.assigned);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/departments/:id/assignments POST]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
