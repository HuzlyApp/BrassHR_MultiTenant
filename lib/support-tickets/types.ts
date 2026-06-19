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
