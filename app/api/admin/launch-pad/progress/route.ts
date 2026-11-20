import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLaunchPadContext, loadLaunchPadProgress, saveLaunchPadStep } from "@/lib/launch-pad/server";

export async function GET(request: Request) {
  const ctx = await requireLaunchPadContext(request, { allowStaffRead: true });
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ tenantId: ctx.tenantId, progress: await loadLaunchPadProgress(ctx) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load Launch Pad progress." }, { status: 503 });
  }
}

// Domain completion can only be recorded by saving a valid, available domain.
const input = z.object({ stepId: z.enum(["logo", "branding", "preview", "invite", "organization"]) }).strict();

export async function POST(request: Request) {
  const ctx = await requireLaunchPadContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid Launch Pad task." }, { status: 400 });
  try {
    await saveLaunchPadStep(ctx, parsed.data.stepId);
    return NextResponse.json({ tenantId: ctx.tenantId, progress: await loadLaunchPadProgress(ctx) });
  } catch {
    return NextResponse.json({ error: "Could not save Launch Pad progress. Please try again." }, { status: 503 });
  }
}
