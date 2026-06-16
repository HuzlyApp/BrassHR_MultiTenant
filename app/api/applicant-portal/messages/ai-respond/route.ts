import { NextRequest, NextResponse } from "next/server";
import { insertApplicantAiMessage, respondToApplicantInquiry } from "@/lib/applicant-portal/message-ai-assistant";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function toClientMessage(row: Awaited<ReturnType<typeof respondToApplicantInquiry>>) {
  return {
    id: row.id,
    sender_role: row.sender_role,
    sender_name: row.sender_name,
    body: row.body,
    created_at: row.created_at,
    message_type: row.message_type,
    metadata: row.metadata,
  };
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "applicant-messages-ai",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_APPLICANT_HELP_PER_HOUR ?? 60),
      windowMs: 60 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { inquiry?: string };
    const inquiry = body.inquiry?.trim() ?? "";
    if (!inquiry) {
      return NextResponse.json({ error: "Missing inquiry." }, { status: 400 });
    }

    const aiMessage = await respondToApplicantInquiry(auth.supabase, {
      tenantId: auth.applicant.tenant_id,
      workerId: auth.applicant.id,
      inquiry,
    });

    return NextResponse.json({ message: toClientMessage(aiMessage) });
  } catch (err) {
    console.error("[applicant-portal/messages/ai-respond:post]", err);
    try {
      const auth = await requireApprovedApplicant(req);
      if (!(auth instanceof NextResponse)) {
        const aiMessage = await insertApplicantAiMessage(auth.supabase, {
          tenantId: auth.applicant.tenant_id,
          workerId: auth.applicant.id,
          body: "I couldn't process your question right now. Please try again or contact your recruiter directly.",
          metadata: { source: "error", type: "error" },
        });
        return NextResponse.json({ message: toClientMessage(aiMessage) });
      }
    } catch (innerErr) {
      console.error("[applicant-portal/messages/ai-respond:fallback]", innerErr);
    }
    return NextResponse.json({ error: "Could not generate an assistant response." }, { status: 500 });
  }
}
