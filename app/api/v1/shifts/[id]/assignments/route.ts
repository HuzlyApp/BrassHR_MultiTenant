import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSchedulingContext, schedulingError, invalidSchedule } from "@/lib/scheduling/api-context";
import { assignmentSchema, shiftSchema, SchedulingError } from "@/lib/scheduling/v1-contract";
import { SHIFT_COLUMNS, validateShiftFeatures } from "@/lib/scheduling/v1-service";

export const runtime = "nodejs";
export async function POST(request: Request, route: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchedulingContext(request);
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success) {
      return invalidSchedule(undefined, { required: ["id"], example: "/api/v1/shifts/{uuid}/assignments" });
    }
    if (!parsed.success) {
      return invalidSchedule(parsed.error, {
        required: ["worker_ids"],
        optional: ["start_date", "end_date", "pay_rate", "bill_rate"],
      });
    }
    if (parsed.data.bill_rate !== undefined && !context.features.bill_rates) {
      throw new SchedulingError("Bill rates are disabled", "FEATURE_DISABLED", 403);
    }
    const { data: shift, error: shiftError } = await context.supabase.from("shifts").select(SHIFT_COLUMNS)
      .eq("tenant_id", context.tenantId).eq("id", id).maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift) throw new SchedulingError("Shift not found", "NOT_FOUND", 404);
    const { id: _id, ...fields } = shift;
    void _id;
    const checked = shiftSchema.safeParse(fields);
    if (!checked.success) return invalidSchedule(checked.error);
    validateShiftFeatures(checked.data, context.features, context.edition);
    const { data, error } = await context.supabase.rpc("assign_fsd_shift_workers", {
      p_tenant_id: context.tenantId, p_shift_id: id, p_worker_ids: parsed.data.worker_ids,
      p_start_date: parsed.data.start_date ?? null, p_end_date: parsed.data.end_date ?? null,
      p_pay_rate: parsed.data.pay_rate ?? null, p_bill_rate: parsed.data.bill_rate ?? null,
    });
    if (error) throw error;
    const assignments = (data ?? []).map((row: Record<string, unknown>) => {
      const visible = { ...row };
      if (!context.features.bill_rates) delete visible.bill_rate;
      if (!context.features.manage_clients) delete visible.client_id;
      return visible;
    });
    return NextResponse.json({ assignments }, { status: 201 });
  } catch (error) { return schedulingError(error); }
}
