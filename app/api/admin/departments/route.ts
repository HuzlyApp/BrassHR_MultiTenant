import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentRead, requireDepartmentWrite } from "@/lib/departments/api-context";
import { createDepartment, listDepartments } from "@/lib/departments/service";

export const runtime = "nodejs";

export async function GET() {
  const resolved = await requireDepartmentRead();
  if (resolved instanceof NextResponse) return resolved;

  try {
    const departments = await listDepartments(resolved.supabase, resolved.tenantId);
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("[admin/departments GET]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const resolved = await requireDepartmentWrite();
  if (resolved instanceof NextResponse) return resolved;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
  };

  try {
    const department = await createDepartment(resolved.supabase, resolved.tenantId, {
      name: body.name ?? "",
      description: body.description,
    });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("[admin/departments POST]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
