import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDepartmentWrite } from "@/lib/departments/api-context";
import { writeDepartmentApiRecord } from "@/lib/departments/service";
import { departmentApiError, departmentPatchSchema, invalidDepartment } from "@/lib/departments/v1-api";

export const runtime = "nodejs";
type Route = { params: Promise<{ id: string }> };

async function mutate(request: Request, route: Route, remove: boolean) {
  try {
    const context = await requireDepartmentWrite(request);
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    if (!z.uuid().safeParse(id).success) return invalidDepartment();
    const parsed = departmentPatchSchema.safeParse(remove ? { is_active: false } : await request.json().catch(() => null));
    if (!parsed.success) return invalidDepartment();
    const result = await writeDepartmentApiRecord(context.supabase, context.tenantId, id, parsed.data);
    if (!result) return NextResponse.json({ error: "Department not found", code: "NOT_FOUND" }, { status: 404 });
    return remove ? new NextResponse(null, { status: 204 }) : NextResponse.json(result);
  } catch (error) { return departmentApiError(error); }
}

export async function PATCH(request: Request, route: Route) { return mutate(request, route, false); }
export async function DELETE(request: Request, route: Route) { return mutate(request, route, true); }
