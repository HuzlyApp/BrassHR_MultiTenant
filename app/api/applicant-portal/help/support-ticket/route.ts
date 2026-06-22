import { NextRequest, NextResponse } from "next/server";
import {
  HELP_TICKET_CREATED_MESSAGE,
  HELP_TICKET_FAILED_MESSAGE,
  type HelpAssistantTicketCreatedResponse,
} from "@/lib/applicant-portal/help-assistant-types";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { insertSupportTicket } from "@/lib/support-tickets/support-ticket-service";
import { parseSupportTicketCreateBody } from "@/lib/support-tickets/parse-create-request";
import type { SupportTicketPriority } from "@/lib/support-tickets/types";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const PRIORITIES = new Set<SupportTicketPriority>(["low", "normal", "high", "urgent"]);

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

    const body = await parseSupportTicketCreateBody(req);

    if (!body.subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (!body.description) {
      return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
    }
    if (body.priority && !PRIORITIES.has(body.priority)) {
      return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
    }

    const result = await insertSupportTicket(auth.supabase, {
      tenantId: auth.applicant.tenant_id,
      userId: auth.user.id,
      applicantId: auth.applicant.id,
      input: {
        subject: body.subject,
        description: body.description,
        category: body.category,
        priority: body.priority,
        source: body.source ?? "ai_fallback",
      },
      files: body.files,
    });

    if ("error" in result) {
      return NextResponse.json({ type: "error", message: HELP_TICKET_FAILED_MESSAGE }, { status: 500 });
    }

    const response: HelpAssistantTicketCreatedResponse = {
      type: "support_ticket_created",
      message: HELP_TICKET_CREATED_MESSAGE,
      ticket_id: result.ticket.id,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[applicant-portal/help/support-ticket:post]", err);
    return NextResponse.json({ type: "error", message: HELP_TICKET_FAILED_MESSAGE }, { status: 500 });
  }
}
