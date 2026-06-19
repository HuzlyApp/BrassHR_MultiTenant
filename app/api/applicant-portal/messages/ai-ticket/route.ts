import { NextRequest, NextResponse } from "next/server";
import { createApplicantSupportTicketFromChat } from "@/lib/applicant-portal/message-ai-assistant";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "applicant-messages-ai-ticket",
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
      subject?: string;
      description?: string;
      category?: string;
      priority?: "low" | "normal" | "high" | "urgent";
    };

    const description = (body.description ?? body.inquiry ?? "").trim();
    const subject = body.subject?.trim() ?? "";
    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
    }

    const result = await createApplicantSupportTicketFromChat(auth.supabase, {
      tenantId: auth.applicant.tenant_id,
      workerId: auth.applicant.id,
      userId: auth.user.id,
      subject,
      description,
      category: body.category,
      priority: body.priority,
    });

    if ("error" in result) {
      return NextResponse.json(
        {
          type: "error",
          message: result.error,
          chatMessage: result.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      type: "support_ticket_created",
      ticket_id: result.ticketId,
      message: result.message,
      chatMessage: result.message,
    });
  } catch (err) {
    console.error("[applicant-portal/messages/ai-ticket:post]", err);
    return NextResponse.json(
      { error: "I couldn't create the support ticket right now. Please try again or contact your recruiter directly." },
      { status: 500 }
    );
  }
}
