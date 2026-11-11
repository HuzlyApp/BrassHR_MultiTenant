import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { loadWorkerMonthSchedule } from "@/lib/applicant-portal/load-worker-month-schedule";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(
  value: string | null,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: false, error: `Missing ${label}` };
  if (!DATE_RE.test(trimmed)) return { ok: false, error: `Invalid ${label}` };
  return { ok: true, value: trimmed };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApprovedApplicant(req);
    if (ctx instanceof NextResponse) return ctx;

    const startCheck = parseDateParam(req.nextUrl.searchParams.get("start"), "start");
    if (!startCheck.ok) {
      return NextResponse.json({ error: startCheck.error }, { status: 400 });
    }

    const endCheck = parseDateParam(req.nextUrl.searchParams.get("end"), "end");
    if (!endCheck.ok) {
      return NextResponse.json({ error: endCheck.error }, { status: 400 });
    }

    if (startCheck.value > endCheck.value) {
      return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
    }

    const data = await loadWorkerMonthSchedule(
      ctx.supabase,
      ctx.applicant.tenant_id,
      ctx.applicant.id,
      startCheck.value,
      endCheck.value
    );

    return NextResponse.json(data);
  } catch (err) {
    console.error("[applicant-portal/schedule GET]", err);
    return NextResponse.json({ error: "Failed to load your schedule." }, { status: 500 });
  }
}
