import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTimeContext, timeApiError } from "./api-context";
import { timesheetReviewSchema } from "./v1-contract";
import { getPeriodTimesheet, transitionPeriodTimesheet } from "./v1-service";
import { invalidTimeInput } from "@/lib/scheduling/api-context";
export async function handleTimesheetTransition(
  request: Request,
  route: { params: Promise<{ id: string }> },
  action: "submit" | "approve" | "reject",
) {
  try {
    const context = await requireTimeContext(request, action !== "submit");
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    if (!z.uuid().safeParse(id).success) {
      return invalidTimeInput(undefined, {
        required: ["id"],
        example: "/api/v1/timesheets/{uuid}/approve",
      });
    }
    let body: unknown;
    try {
      const text = await request.text();
      body = text.trim() ? JSON.parse(text) : {};
    } catch {
      return invalidTimeInput(undefined, {
        optional: ["notes"],
        example: action === "reject" ? '{"notes":"Missing punch"}' : "{}",
      });
    }
    const parsed = timesheetReviewSchema.safeParse(body);
    if (!parsed.success || (action === "reject" && !parsed.data.notes)) {
      return invalidTimeInput(parsed.success ? undefined : parsed.error, {
        required: action === "reject" ? ["notes"] : undefined,
        optional: action === "reject" ? undefined : ["notes"],
        example: action === "reject" ? '{"notes":"Missing punch"}' : "{}",
      });
    }
    await getPeriodTimesheet(
      context.supabase,
      context.tenantId,
      context.ownEmployeeIds,
      id,
    );
    return NextResponse.json(
      await transitionPeriodTimesheet(
        context.supabase,
        context.tenantId,
        context.auth.userId,
        id,
        action,
        parsed.data.notes,
      ),
    );
  } catch (error) {
    return timeApiError(error);
  }
}
