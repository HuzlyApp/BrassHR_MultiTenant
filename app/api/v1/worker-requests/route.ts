import { NextResponse } from "next/server";
import { requireWorkerRequestContext, workerRequestError } from "@/lib/workers/requests-context";
import { requestCreateSchema, requestListSchema } from "@/lib/workers/requests-contract";
import { createWorkerRequest, listWorkerRequests } from "@/lib/workers/requests-service";
import { invalidSchedule } from "@/lib/scheduling/api-context";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const context = await requireWorkerRequestContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = requestListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await listWorkerRequests(context.supabase, context.tenantId, context.ownWorkerIds, parsed.data),
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return workerRequestError(error); }
}
export async function POST(request: Request) {
  try {
    const context = await requireWorkerRequestContext(request);
    if (context instanceof NextResponse) return context;
    const parsed = requestCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidSchedule();
    return NextResponse.json(await createWorkerRequest(context.supabase, context.tenantId, context.auth.userId, context.ownWorkerIds, parsed.data), { status: 201 });
  } catch (error) { return workerRequestError(error); }
}
