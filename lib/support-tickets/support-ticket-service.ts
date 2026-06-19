import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateSupportTicketInput,
  SupportTicketListItem,
  SupportTicketRow,
} from "@/lib/support-tickets/types";

export function summarizeTicketSubject(description: string, subject?: string): string {
  const trimmedSubject = subject?.trim();
  if (trimmedSubject) return trimmedSubject.slice(0, 200);
  const line = description.trim().split(/\n+/)[0] ?? "Support request";
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

export async function insertSupportTicket(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    userId: string;
    applicantId: string;
    input: CreateSupportTicketInput;
  }
): Promise<{ ticket: SupportTicketRow } | { error: string }> {
  const description = params.input.description.trim();
  if (!description) {
    return { error: "Please describe your issue." };
  }

  const subject = summarizeTicketSubject(description, params.input.subject);
  if (!subject.trim()) {
    return { error: "Subject is required." };
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      applicant_id: params.applicantId,
      subject,
      description,
      category: params.input.category?.trim() || "general",
      source: params.input.source?.trim() || "manual",
      status: "Open",
      priority: params.input.priority ?? "normal",
    })
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by"
    )
    .single();

  if (error || !data) {
    console.error("[support-tickets:insert]", error);
    return { error: "Could not create support ticket." };
  }

  return { ticket: data as SupportTicketRow };
}

export async function listApplicantSupportTickets(
  supabase: SupabaseClient,
  applicantId: string
): Promise<SupportTicketListItem[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by"
    )
    .eq("applicant_id", applicantId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row as SupportTicketRow),
    applicant_name: null,
    applicant_email: null,
  }));
}

export async function listStaffSupportTickets(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<SupportTicketListItem[]> {
  let query = supabase
    .from("support_tickets")
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by, worker:applicant_id(first_name, last_name, email)"
    )
    .not("applicant_id", "is", null)
    .order("created_at", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const worker = row.worker as
      | { first_name: string | null; last_name: string | null; email: string | null }
      | { first_name: string | null; last_name: string | null; email: string | null }[]
      | null;
    const workerRow = Array.isArray(worker) ? worker[0] : worker;
    const name = workerRow
      ? `${workerRow.first_name ?? ""} ${workerRow.last_name ?? ""}`.trim() || null
      : null;

    const { worker: _worker, ...ticket } = row as SupportTicketRow & {
      worker?: unknown;
    };

    return {
      ...ticket,
      applicant_name: name,
      applicant_email: workerRow?.email ?? null,
    };
  });
}

export async function getSupportTicketById(
  supabase: SupabaseClient,
  ticketId: string
): Promise<SupportTicketListItem | null> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by, worker:applicant_id(first_name, last_name, email)"
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const worker = data.worker as
    | { first_name: string | null; last_name: string | null; email: string | null }
    | { first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
  const workerRow = Array.isArray(worker) ? worker[0] : worker;
  const name = workerRow
    ? `${workerRow.first_name ?? ""} ${workerRow.last_name ?? ""}`.trim() || null
    : null;

  const { worker: _worker, ...ticket } = data as SupportTicketRow & { worker?: unknown };

  return {
    ...ticket,
    applicant_name: name,
    applicant_email: workerRow?.email ?? null,
  };
}

export async function closeSupportTicket(
  supabase: SupabaseClient,
  params: { ticketId: string; closedByUserId: string }
): Promise<{ ticket: SupportTicketRow } | { error: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      status: "Closed",
      closed_at: now,
      closed_by: params.closedByUserId,
      resolved_at: now,
    })
    .eq("id", params.ticketId)
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by"
    )
    .maybeSingle();

  if (error || !data) {
    console.error("[support-tickets:close]", error);
    return { error: "Could not close support ticket." };
  }

  return { ticket: data as SupportTicketRow };
}

export function descriptionPreview(description: string | null, maxLength = 80): string {
  const text = (description ?? "").trim();
  if (!text) return "—";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}
