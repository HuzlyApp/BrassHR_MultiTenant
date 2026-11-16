import { NextResponse } from "next/server";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { holidayQuerySchema, holidaySchema } from "@/lib/scheduling/v1-contract";
import { listTenantHolidays } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = holidayQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await listTenantHolidays(context.supabase, context.tenantId, parsed.data),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return schedulingError(error); }
}
export async function POST(request: Request) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = holidaySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidSchedule();
    const { data, error } = await context.supabase.from("tenant_holidays").insert({ ...parsed.data, tenant_id: context.tenantId })
      .select("id,name,holiday_date,is_paid").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return schedulingError(error); }
}
