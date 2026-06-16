import { NextRequest, NextResponse } from "next/server";
import { searchFaqForInquiry } from "@/lib/applicant-portal/faq-search";
import {
  HELP_FALLBACK_BUTTONS,
  HELP_FALLBACK_MESSAGE,
  type HelpAssistantResponse,
} from "@/lib/applicant-portal/help-assistant-types";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const OUT_OF_SCOPE_PATTERNS = [
  /\b(legal advice|lawyer|attorney|sue|lawsuit)\b/i,
  /\b(medical advice|diagnos|prescription|doctor)\b/i,
  /\b(tax advice|payroll tax|irs)\b/i,
];

function isOutOfScope(inquiry: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(inquiry));
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "applicant-help-ask",
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
      return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
    }

    if (isOutOfScope(inquiry)) {
      const response: HelpAssistantResponse = {
        type: "fallback",
        message: HELP_FALLBACK_MESSAGE,
        buttons: HELP_FALLBACK_BUTTONS,
      };
      return NextResponse.json(response);
    }

    const match = await searchFaqForInquiry(auth.supabase, auth.applicant.tenant_id, inquiry);
    if (!match) {
      const response: HelpAssistantResponse = {
        type: "fallback",
        message: HELP_FALLBACK_MESSAGE,
        buttons: HELP_FALLBACK_BUTTONS,
      };
      return NextResponse.json(response);
    }

    const response: HelpAssistantResponse = {
      type: "answer",
      message: match.message,
      source: "faq",
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[applicant-portal/help/ask:post]", err);
    return NextResponse.json({ error: "Could not process your question." }, { status: 500 });
  }
}
