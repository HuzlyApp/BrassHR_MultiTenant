import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLaunchPadContext } from "@/lib/launch-pad/server";
import { SIGNUP_INTEREST_KEYS, type SignupInterests } from "@/lib/signup/signup-interests";

export async function GET(request: Request) {
  const ctx = await requireLaunchPadContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.sb.from("tenant_signup_interests")
    .select("interest_keys, skipped, answered_at").eq("tenant_id", ctx.tenantId).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your signup interests. Please try again." }, { status: 503 });
  const interests: SignupInterests = data ? {
    keys: data.interest_keys, skipped: data.skipped, answeredAt: data.answered_at,
  } : { keys: [], skipped: false, answeredAt: null };
  return NextResponse.json({ tenantId: ctx.tenantId, interests }, { headers: { "Cache-Control": "no-store" } });
}

const input = z.object({
  keys: z.array(z.enum(SIGNUP_INTEREST_KEYS)).max(SIGNUP_INTEREST_KEYS.length),
  skipped: z.boolean(),
}).strict().refine((value) => value.skipped ? value.keys.length === 0 : value.keys.length > 0, {
  message: "Choose at least one interest, or use Skip for now.",
});

export async function PUT(request: Request) {
  const ctx = await requireLaunchPadContext(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Choose valid signup interests." }, { status: 400 });
  // Store keys in catalog order for consistent reporting, without duplicates.
  const keys = SIGNUP_INTEREST_KEYS.filter((key) => parsed.data.keys.includes(key));
  const { data, error } = await ctx.sb.from("tenant_signup_interests").upsert({
    tenant_id: ctx.tenantId,
    interest_keys: keys,
    skipped: parsed.data.skipped,
    answered_by: ctx.auth.userId,
    answered_at: new Date().toISOString(),
  }, { onConflict: "tenant_id" }).select("interest_keys, skipped, answered_at").single();
  if (error || !data) return NextResponse.json({ error: "Could not save your signup interests. Please try again." }, { status: 503 });
  return NextResponse.json({ tenantId: ctx.tenantId, interests: { keys: data.interest_keys, skipped: data.skipped, answeredAt: data.answered_at } });
}
