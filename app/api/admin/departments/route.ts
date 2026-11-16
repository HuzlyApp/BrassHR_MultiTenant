import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentRead, requireDepartmentWrite } from "@/lib/departments/api-context";
import {
  createDepartment,
  listDepartments,
  setDepartmentAssignment,
} from "@/lib/departments/service";

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
    code?: string | null;
    description?: string | null;
    memberIds?: string[];
  };

  try {
    const department = await createDepartment(resolved.supabase, resolved.tenantId, {
      name: body.name ?? "",
      code: body.code,
      description: body.description,
    });

    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [];
    if (memberIds.length > 0) {
      for (const memberId of memberIds) {
        await setDepartmentAssignment(
          resolved.supabase,
          resolved.tenantId,
          department.id,
          "candidate",
          memberId,
          true
        );
      }
      department.candidateCount = memberIds.length;
    }

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("[admin/departments POST]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
