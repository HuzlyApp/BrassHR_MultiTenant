import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentRead, requireDepartmentWrite } from "@/lib/departments/api-context";
import {
  assignDepartmentMembers,
  createDepartment,
  listDepartments,
} from "@/lib/departments/service";
import type { DepartmentMemberKind, DepartmentMemberRef } from "@/lib/departments/types";

export const runtime = "nodejs";

function parseMemberRefs(raw: unknown): DepartmentMemberRef[] {
  if (!Array.isArray(raw)) return [];
  const members: DepartmentMemberRef[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      // Legacy create payload sent bare worker ids.
      members.push({ kind: "worker", id: item.trim() });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const kind = (item as { kind?: string }).kind;
    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    if (kind === "worker" && id) {
      members.push({ kind: "worker" as DepartmentMemberKind, id });
    }
  }
  return members;
}

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
    primaryContact?: string | null;
    memberIds?: unknown;
    members?: unknown;
  };

  try {
    const department = await createDepartment(resolved.supabase, resolved.tenantId, {
      name: body.name ?? "",
      code: body.code,
      description: body.description,
      primaryContact: body.primaryContact,
    });

    const members = parseMemberRefs(body.members ?? body.memberIds);
    if (members.length > 0) {
      const assigned = await assignDepartmentMembers(
        resolved.supabase,
        resolved.tenantId,
        department.id,
        members
      );
      department.candidateCount = assigned;
    }

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("[admin/departments POST]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
