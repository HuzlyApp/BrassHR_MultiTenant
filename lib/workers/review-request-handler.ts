import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkerRequestContext, workerRequestError } from "./requests-context";
import { requestReviewSchema } from "./requests-contract";
import { reviewWorkerRequest } from "./requests-service";
import { invalidSchedule } from "@/lib/scheduling/api-context";

export async function handleWorkerRequestReview(request: Request, route: { params: Promise<{ id: string }> }, decision: "approved" | "rejected") {
  try {
    const context = await requireWorkerRequestContext(request, true);
    if (context instanceof NextResponse) return context;
    const { id } = await route.params;
    if (!z.uuid().safeParse(id).success) return invalidSchedule();
    const text = await request.text();
    let body: unknown;
    try { body = text.trim() ? JSON.parse(text) : {}; } catch { return invalidSchedule(); }
    const parsed = requestReviewSchema.safeParse(body);
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await reviewWorkerRequest(context.supabase, context.tenantId, context.auth.userId, id, decision, parsed.data.notes));
  } catch (error) { return workerRequestError(error); }
}
