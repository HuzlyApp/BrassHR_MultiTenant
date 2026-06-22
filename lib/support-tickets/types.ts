export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicketStatus =
  | "Open"
  | "Pending"
  | "In Progress"
  | "Resolved"
  | "Closed";

export type SupportTicketRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  applicant_id: string | null;
  recruiter_id: string | null;
  subject: string | null;
  description: string | null;
  status: SupportTicketStatus;
  category: string | null;
  source: string | null;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
};

export type SupportTicketListItem = SupportTicketRow & {
  applicant_name: string | null;
  applicant_email: string | null;
};

export type CreateSupportTicketInput = {
  subject: string;
  description: string;
  category?: string;
  priority?: SupportTicketPriority;
  source?: string;
};

export type SupportTicketSenderRole = "applicant" | "staff";

export type SupportTicketMessageRow = {
  id: string;
  tenant_id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: SupportTicketSenderRole;
  message: string;
  created_at: string;
};

export type SupportTicketAttachmentRow = {
  id: string;
  tenant_id: string;
  ticket_id: string;
  message_id: string | null;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  storage_bucket: string;
  created_at: string;
};

export type SupportTicketMessageWithAttachments = SupportTicketMessageRow & {
  attachments: SupportTicketAttachmentRow[];
};

export type SupportTicketConversationItem = SupportTicketListItem & {
  lastMessagePreview: string;
  lastMessageAt: string;
};
