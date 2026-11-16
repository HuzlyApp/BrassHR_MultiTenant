import { NextResponse } from "next/server";
import { requireWorkerRequestContext } from "@/lib/workers/requests-context";
import { schedulingError } from "@/lib/scheduling/api-context";
import { WorkerRequestError } from "@/lib/workers/requests-contract";
import { TimeApiError } from "./v1-contract";

export async function requireTimeContext(request: Request, staffOnly = false) {
  const context = await requireWorkerRequestContext(request, staffOnly, false);
  if (context instanceof NextResponse) return context;
  if (!context.features.timesheets)
    throw new TimeApiError("Timesheets disabled", "FEATURE_DISABLED", 403);
  let ownEmployeeIds: string[] | null = null;
  if (context.ownWorkerIds) {
    const { data, error } = await context.supabase
      .from("workers")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .in("candidate_id", context.ownWorkerIds);
    if (error) throw error;
    ownEmployeeIds = (data ?? []).map((w) => String(w.id));
    if (!ownEmployeeIds.length)
      throw new TimeApiError("No hired employee profile", "FORBIDDEN", 403);
  }
  return { ...context, ownEmployeeIds };
}
export function timeApiError(error: unknown) {
  if (error instanceof TimeApiError || error instanceof WorkerRequestError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  const code = (error as { code?: string } | null)?.code;
  if (code === "P0001")
    return NextResponse.json(
      {
        error: "Invalid clock state or locked/incomplete timesheet",
        code: "CONFLICT",
      },
      { status: 409 },
    );
  if (code === "42501")
    return NextResponse.json(
      {
        error: "Insufficient permission or self-review is forbidden",
        code: "FORBIDDEN",
      },
      { status: 403 },
    );
  return schedulingError(error);
}
