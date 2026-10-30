import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentRead, requireDepartmentWrite } from "@/lib/departments/api-context";
import { deleteDepartment, listDepartmentAssignments, updateDepartment } from "@/lib/departments/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const resolved = await requireDepartmentRead();
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await context.params;

  try {
    const assignments = await listDepartmentAssignments(resolved.supabase, resolved.tenantId, id);
    return NextResponse.json(assignments);
  } catch (error) {
    console.error("[admin/departments/:id GET]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const resolved = await requireDepartmentWrite();
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  };

  try {
    await updateDepartment(resolved.supabase, resolved.tenantId, id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/departments/:id PATCH]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const resolved = await requireDepartmentWrite();
  if (resolved instanceof NextResponse) return resolved;
  const { id } = await context.params;

  try {
    await deleteDepartment(resolved.supabase, resolved.tenantId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/departments/:id DELETE]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
