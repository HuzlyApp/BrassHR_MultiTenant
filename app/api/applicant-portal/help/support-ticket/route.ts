import { NextRequest, NextResponse } from "next/server";
import {
  HELP_TICKET_CREATED_MESSAGE,
  HELP_TICKET_FAILED_MESSAGE,
  type HelpAssistantTicketCreatedResponse,
} from "@/lib/applicant-portal/help-assistant-types";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function summarizeSubject(description: string): string {
  const line = description.trim().split(/\n+/)[0] ?? "Support request";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "applicant-help-ticket",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_APPLICANT_HELP_TICKETS_PER_HOUR ?? 10),
      windowMs: 60 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      inquiry?: string;
      description?: string;
      subject?: string;
      category?: string;
    };

    const description = (body.description ?? body.inquiry ?? "").trim();
    if (!description) {
      return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
    }

    const subject = (body.subject?.trim() || summarizeSubject(description)).slice(0, 200);
    const category = body.category?.trim() || "general";

    const insertRes = await auth.supabase
      .from("support_tickets")
      .insert({
        user_id: auth.user.id,
        tenant_id: auth.applicant.tenant_id,
        applicant_id: auth.applicant.id,
        subject,
        description,
        category,
        source: "ai_fallback",
        status: "Open",
        priority: "normal",
      })
      .select("id")
      .single();

    if (insertRes.error || !insertRes.data?.id) {
      console.error("[applicant-portal/help/support-ticket:post]", insertRes.error);
      return NextResponse.json({ type: "error", message: HELP_TICKET_FAILED_MESSAGE }, { status: 500 });
    }

    const response: HelpAssistantTicketCreatedResponse = {
      type: "support_ticket_created",
      message: HELP_TICKET_CREATED_MESSAGE,
      ticket_id: insertRes.data.id,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[applicant-portal/help/support-ticket:post]", err);
    return NextResponse.json({ type: "error", message: HELP_TICKET_FAILED_MESSAGE }, { status: 500 });
  }
}
