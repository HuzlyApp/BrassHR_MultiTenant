import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySupportTicketCreated } from "@/lib/notifications/create-notification";
import { insertTicketMessage } from "@/lib/support-tickets/support-ticket-messages";
import { descriptionPreview } from "@/lib/support-tickets/support-ticket-display";
import {
  notifyDepartmentPrimaryContact,
  resolveTicketCategoryLabel,
} from "@/lib/support-tickets/notify-department-primary-contact";
import {
  firstTicketSubjectMessageError,
  validateTicketSubjectAndMessage,
} from "@/lib/support-tickets/ticket-field-validation";
import type {
  CreateSupportTicketInput,
  SupportTicketListItem,
  SupportTicketRow,
  SupportTicketSenderRole,
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
    /** Auth user who owns/requests the ticket (usually the worker). */
    userId: string;
    /** Worker requester when creating on behalf; null for staff self-service tickets. */
    applicantId: string | null;
    input: CreateSupportTicketInput;
    files?: File[];
    /** Staff user creating on behalf of the worker (auditing via recruiter_id). */
    createdByStaffUserId?: string | null;
    /** Who authored the initial message. */
    initialSenderRole?: SupportTicketSenderRole;
    /** Skip staff fan-out when staff opens a ticket for a worker. */
    notifyStaff?: boolean;
    notifyApplicant?: boolean;
  }
): Promise<{ ticket: SupportTicketRow } | { error: string }> {
  const description = params.input.description.trim();
  const subjectInput = (params.input.subject ?? "").trim();
  const subjectMessageError = firstTicketSubjectMessageError(
    validateTicketSubjectAndMessage({ subject: subjectInput, description })
  );
  if (subjectMessageError) {
    return { error: subjectMessageError };
  }

  const subject = summarizeTicketSubject(description, subjectInput);

  const initialSenderRole = params.initialSenderRole ?? "applicant";
  const createdByStaffUserId = params.createdByStaffUserId?.trim() || null;
  const shouldNotifyStaff =
    params.notifyStaff === true ||
    (params.notifyStaff !== false && !createdByStaffUserId);

  const rawCategory = params.input.category?.trim() || "general";
  let category = rawCategory;
  try {
    category = await resolveTicketCategoryLabel(supabase, params.tenantId, rawCategory);
  } catch (resolveError) {
    console.error("[support-tickets:resolve-category]", resolveError);
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      applicant_id: params.applicantId,
      recruiter_id: createdByStaffUserId,
      subject,
      description,
      category,
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

  const ticket = data as SupportTicketRow;
  const messageResult = await insertTicketMessage(supabase, {
    tenantId: params.tenantId,
    ticketId: ticket.id,
    senderId: createdByStaffUserId ?? params.userId,
    senderRole: initialSenderRole,
    message: description,
    files: params.files,
  });

  if ("error" in messageResult) {
    console.error("[support-tickets:initial-message]", messageResult.error);
  }

  try {
    await notifySupportTicketCreated(supabase, {
      tenantId: params.tenantId,
      ticketId: ticket.id,
      subject,
      createdByUserId: createdByStaffUserId ?? params.userId,
      notifyStaff: shouldNotifyStaff,
      notifyApplicantUserId:
        params.notifyApplicant && createdByStaffUserId && params.applicantId
          ? params.userId
          : null,
    });
  } catch (notifyError) {
    console.error("[support-tickets:notify-created]", notifyError);
  }

  try {
    await notifyDepartmentPrimaryContact(supabase, {
      tenantId: params.tenantId,
      // Prefer original id so lookup stays exact; name works as fallback.
      category: rawCategory,
      ticketId: ticket.id,
      subject,
      description,
    });
  } catch (departmentNotifyError) {
    console.error("[support-tickets:notify-department]", departmentNotifyError);
  }

  return { ticket };
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

/** Archive maps to Resolved in the existing Open/Closed/Archived UI filters. */
export async function archiveSupportTicket(
  supabase: SupabaseClient,
  params: { ticketId: string }
): Promise<{ ticket: SupportTicketRow } | { error: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      status: "Resolved",
      resolved_at: now,
      closed_at: null,
      closed_by: null,
    })
    .eq("id", params.ticketId)
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by"
    )
    .maybeSingle();

  if (error || !data) {
    console.error("[support-tickets:archive]", error);
    return { error: "Could not archive support ticket." };
  }

  return { ticket: data as SupportTicketRow };
}

export async function reopenSupportTicket(
  supabase: SupabaseClient,
  params: { ticketId: string }
): Promise<{ ticket: SupportTicketRow } | { error: string }> {
  const { data, error } = await supabase
    .from("support_tickets")
    .update({
      status: "Open",
      resolved_at: null,
      closed_at: null,
      closed_by: null,
    })
    .eq("id", params.ticketId)
    .select(
      "id, tenant_id, user_id, applicant_id, recruiter_id, subject, description, status, category, source, priority, created_at, updated_at, resolved_at, closed_at, closed_by"
    )
    .maybeSingle();

  if (error || !data) {
    console.error("[support-tickets:reopen]", error);
    return { error: "Could not reopen support ticket." };
  }

  return { ticket: data as SupportTicketRow };
}

export { descriptionPreview };
