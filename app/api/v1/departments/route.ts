import { NextResponse } from "next/server";
import { requireDepartmentRead, requireDepartmentWrite } from "@/lib/departments/api-context";
import { listDepartmentApiRecords, writeDepartmentApiRecord } from "@/lib/departments/service";
import { departmentApiError, departmentCreateSchema, departmentListSchema, invalidDepartment } from "@/lib/departments/v1-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireDepartmentRead(request);
    if (context instanceof NextResponse) return context;
    const parsed = departmentListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return invalidDepartment();
    const { include_inactive, page, limit } = parsed.data;
    return NextResponse.json(await listDepartmentApiRecords(context.supabase, context.tenantId,
      include_inactive === "true", page, limit), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return departmentApiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireDepartmentWrite(request);
    if (context instanceof NextResponse) return context;
    const parsed = departmentCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidDepartment();
    const result = await writeDepartmentApiRecord(context.supabase, context.tenantId, null, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return departmentApiError(error); }
}
