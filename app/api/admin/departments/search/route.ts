import { NextRequest, NextResponse } from "next/server";
import { departmentErrorStatus, requireDepartmentRead } from "@/lib/departments/api-context";
import { searchDepartmentTargets } from "@/lib/departments/service";
import type { DepartmentAssignmentKind } from "@/lib/departments/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const resolved = await requireDepartmentRead();
  if (resolved instanceof NextResponse) return resolved;

  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind: DepartmentAssignmentKind | null =
    kindParam === "job" || kindParam === "candidate" ? kindParam : null;
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!kind) {
    return NextResponse.json({ error: "Choose jobs or candidates to search." }, { status: 400 });
  }

  try {
    const results = await searchDepartmentTargets(resolved.supabase, resolved.tenantId, kind, query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[admin/departments/search GET]", error);
    const { status, message } = departmentErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
}
