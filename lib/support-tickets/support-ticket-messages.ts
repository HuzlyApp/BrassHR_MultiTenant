import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_TICKET_FILES_BUCKET } from "@/lib/supabase-storage-buckets";
import type {
  SupportTicketAttachmentRow,
  SupportTicketConversationItem,
  SupportTicketListItem,
  SupportTicketMessageRow,
  SupportTicketMessageWithAttachments,
  SupportTicketSenderRole,
} from "@/lib/support-tickets/types";
import { uploadSupportTicketFile } from "@/lib/support-tickets/support-ticket-upload";

function messagePreview(text: string | null, maxLength = 80): string {
  const value = (text ?? "").trim();
  if (!value) return "—";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

const MESSAGE_SELECT =
  "id, tenant_id, ticket_id, sender_id, sender_role, message, created_at";

const ATTACHMENT_SELECT =
  "id, tenant_id, ticket_id, message_id, uploaded_by, file_name, file_path, file_type, file_size, storage_bucket, created_at";

export async function listTicketMessages(
  supabase: SupabaseClient,
  ticketId: string
): Promise<SupportTicketMessageRow[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select(MESSAGE_SELECT)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupportTicketMessageRow[];
}

export async function listTicketAttachments(
  supabase: SupabaseClient,
  ticketId: string
): Promise<SupportTicketAttachmentRow[]> {
  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupportTicketAttachmentRow[];
}

export async function getTicketThread(
  supabase: SupabaseClient,
  ticketId: string
): Promise<SupportTicketMessageWithAttachments[]> {
  const [messages, attachments] = await Promise.all([
    listTicketMessages(supabase, ticketId),
    listTicketAttachments(supabase, ticketId),
  ]);

  const attachmentsByMessage = new Map<string, SupportTicketAttachmentRow[]>();
  for (const attachment of attachments) {
    const key = attachment.message_id ?? "__ticket__";
    const list = attachmentsByMessage.get(key) ?? [];
    list.push(attachment);
    attachmentsByMessage.set(key, list);
  }

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }));
}

export async function insertTicketMessage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    ticketId: string;
    senderId: string;
    senderRole: SupportTicketSenderRole;
    message: string;
    files?: File[];
  }
): Promise<{ message: SupportTicketMessageWithAttachments } | { error: string }> {
  const text = params.message.trim();
  if (!text && (!params.files || params.files.length === 0)) {
    return { error: "Message or attachment is required." };
  }

  const body = text || "(attachment)";

  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({
      tenant_id: params.tenantId,
      ticket_id: params.ticketId,
      sender_id: params.senderId,
      sender_role: params.senderRole,
      message: body,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error || !data) {
    console.error("[support-ticket-messages:insert]", error);
    return { error: "Could not send message." };
  }

  const attachments: SupportTicketAttachmentRow[] = [];
  for (const file of params.files ?? []) {
    try {
      const uploaded = await uploadSupportTicketFile(supabase, file, {
        tenantId: params.tenantId,
        ticketId: params.ticketId,
        uploadedBy: params.senderId,
      });

      const { data: attachmentRow, error: attachmentError } = await supabase
        .from("support_ticket_attachments")
        .insert({
          tenant_id: params.tenantId,
          ticket_id: params.ticketId,
          message_id: data.id,
          uploaded_by: params.senderId,
          file_name: uploaded.fileName,
          file_path: uploaded.filePath,
          file_type: uploaded.fileType,
          file_size: uploaded.fileSize,
          storage_bucket: SUPPORT_TICKET_FILES_BUCKET,
        })
        .select(ATTACHMENT_SELECT)
        .single();

      if (attachmentError || !attachmentRow) {
        console.error("[support-ticket-messages:attachment]", attachmentError);
        continue;
      }
      attachments.push(attachmentRow as SupportTicketAttachmentRow);
    } catch (uploadErr) {
      console.error("[support-ticket-messages:upload]", uploadErr);
    }
  }

  await supabase
    .from("support_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.ticketId);

  return {
    message: {
      ...(data as SupportTicketMessageRow),
      attachments,
    },
  };
}

export async function enrichTicketsWithMessagePreviews(
  supabase: SupabaseClient,
  tickets: SupportTicketListItem[]
): Promise<SupportTicketConversationItem[]> {
  if (tickets.length === 0) return [];

  const ticketIds = tickets.map((ticket) => ticket.id);
  const { data, error } = await supabase.rpc("latest_support_ticket_message_previews", {
    p_ticket_ids: ticketIds,
  });

  if (error) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("support_ticket_messages")
      .select("ticket_id, message, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(ticketIds.length * 5, 200));

    if (fallbackErr) throw fallbackErr;

    const previewByTicket = new Map<string, { preview: string; lastMessageAt: string }>();
    for (const row of fallback ?? []) {
      if (!previewByTicket.has(row.ticket_id)) {
        previewByTicket.set(row.ticket_id, {
          preview: row.message as string,
          lastMessageAt: row.created_at as string,
        });
      }
    }

    return tickets.map((ticket) => {
      const preview = previewByTicket.get(ticket.id);
      return {
        ...ticket,
        lastMessagePreview: messagePreview(preview?.preview ?? null),
        lastMessageAt: preview?.lastMessageAt ?? ticket.updated_at,
      };
    });
  }

  const previewByTicket = new Map<string, { preview: string; lastMessageAt: string }>();
  for (const row of data ?? []) {
    if (!previewByTicket.has(row.ticket_id)) {
      previewByTicket.set(row.ticket_id, {
        preview: row.message as string,
        lastMessageAt: row.created_at as string,
      });
    }
  }

  return tickets.map((ticket) => {
    const latest = previewByTicket.get(ticket.id);
    return {
      ...ticket,
      lastMessagePreview: latest?.preview ?? messagePreview(ticket.description),
      lastMessageAt: latest?.lastMessageAt ?? ticket.updated_at,
    };
  });
}
