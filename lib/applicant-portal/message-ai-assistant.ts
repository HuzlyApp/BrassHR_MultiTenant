import type { SupabaseClient } from "@supabase/supabase-js";
import type { HelpAssistantButton } from "@/lib/applicant-portal/help-assistant-types";
import {
  HELP_FALLBACK_BUTTONS,
  HELP_FALLBACK_MESSAGE,
  HELP_TICKET_CREATED_MESSAGE,
  HELP_TICKET_FAILED_MESSAGE,
} from "@/lib/applicant-portal/help-assistant-types";
import { searchFaqForInquiry } from "@/lib/applicant-portal/faq-search";

export type ApplicantAiMessageMetadata = {
  source: "faq" | "ai_fallback" | "support_ticket" | "error";
  type: "answer" | "fallback" | "support_ticket_created" | "error";
  faq_ids?: string[];
  confidence?: number;
  buttons?: HelpAssistantButton[];
  ticket_id?: string;
};

export type ApplicantAiChatMessage = {
  id: string;
  sender_role: "ai";
  sender_name: string;
  body: string;
  created_at: string;
  message_type: "text";
  metadata: ApplicantAiMessageMetadata;
};

const OUT_OF_SCOPE_PATTERNS = [
  /\b(legal advice|lawyer|attorney|sue|lawsuit)\b/i,
  /\b(medical advice|diagnos|prescription|doctor)\b/i,
  /\b(tax advice|payroll tax|irs)\b/i,
];

function isOutOfScope(inquiry: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(inquiry));
}

export async function buildApplicantAiResponse(
  supabase: SupabaseClient,
  tenantId: string,
  inquiry: string
): Promise<{
  body: string;
  metadata: ApplicantAiMessageMetadata;
}> {
  const trimmed = inquiry.trim();
  if (!trimmed || isOutOfScope(trimmed)) {
    return {
      body: HELP_FALLBACK_MESSAGE,
      metadata: {
        source: "ai_fallback",
        type: "fallback",
        buttons: HELP_FALLBACK_BUTTONS,
      },
    };
  }

  const match = await searchFaqForInquiry(supabase, tenantId, trimmed);
  if (!match) {
    return {
      body: HELP_FALLBACK_MESSAGE,
      metadata: {
        source: "ai_fallback",
        type: "fallback",
        buttons: HELP_FALLBACK_BUTTONS,
      },
    };
  }

  const topScore = match.confidence;
  return {
    body: match.message,
    metadata: {
      source: "faq",
      type: "answer",
      faq_ids: match.matches.map((row) => row.id),
      confidence: topScore,
      buttons: [],
    },
  };
}

export async function insertApplicantAiMessage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    workerId: string;
    body: string;
    metadata: ApplicantAiMessageMetadata;
  }
): Promise<ApplicantAiChatMessage> {
  const { data, error } = await supabase
    .from("applicant_messages")
    .insert({
      tenant_id: params.tenantId,
      worker_id: params.workerId,
      sender_role: "ai",
      sender_name: "AI Assistant",
      sender_user_id: null,
      body: params.body,
      message_type: "text",
      metadata: params.metadata,
    })
    .select("id, sender_role, sender_name, body, created_at, message_type, metadata")
    .single();
  if (error) throw error;

  return data as ApplicantAiChatMessage;
}

export async function respondToApplicantInquiry(
  supabase: SupabaseClient,
  params: { tenantId: string; workerId: string; inquiry: string }
): Promise<ApplicantAiChatMessage> {
  const response = await buildApplicantAiResponse(supabase, params.tenantId, params.inquiry);
  return insertApplicantAiMessage(supabase, {
    tenantId: params.tenantId,
    workerId: params.workerId,
    body: response.body,
    metadata: response.metadata,
  });
}

function summarizeSubject(description: string): string {
  const line = description.trim().split(/\n+/)[0] ?? "Support request";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

export async function createApplicantSupportTicketFromChat(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    workerId: string;
    userId: string;
    inquiry: string;
  }
): Promise<{ ticketId: string; message: ApplicantAiChatMessage } | { error: string }> {
  const description = params.inquiry.trim() || "Support request from applicant portal chat";
  const insertRes = await supabase
    .from("support_tickets")
    .insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      applicant_id: params.workerId,
      subject: summarizeSubject(description),
      description,
      category: "general",
      source: "ai_fallback",
      status: "Open",
      priority: "normal",
    })
    .select("id")
    .single();

  if (insertRes.error || !insertRes.data?.id) {
    console.error("[message-ai-assistant:create-ticket]", insertRes.error);
    const message = await insertApplicantAiMessage(supabase, {
      tenantId: params.tenantId,
      workerId: params.workerId,
      body: HELP_TICKET_FAILED_MESSAGE,
      metadata: { source: "error", type: "error" },
    });
    return { error: HELP_TICKET_FAILED_MESSAGE, message };
  }

  const ticketId = insertRes.data.id as string;
  const message = await insertApplicantAiMessage(supabase, {
    tenantId: params.tenantId,
    workerId: params.workerId,
    body: HELP_TICKET_CREATED_MESSAGE,
    metadata: {
      source: "support_ticket",
      type: "support_ticket_created",
      ticket_id: ticketId,
    },
  });

  return { ticketId, message };
}
