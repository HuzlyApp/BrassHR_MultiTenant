export type ApplicantSession = {
  applicant: {
    id: string;
    tenantId: string;
    email: string | null;
    name: string;
  };
  statusLabel: string;
  message: string;
};

export type ApplicantMessage = {
  id: string;
  sender_role: "applicant" | "recruiter" | "ai";
  sender_name?: string | null;
  body: string | null;
  created_at: string;
  message_type?: "text" | "image" | "file";
  attachment_bucket?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_url?: string | null;
  metadata?: ApplicantMessageMetadata | null;
};

export type ApplicantMessageMetadata = {
  source?: "faq" | "ai_fallback" | "support_ticket" | "error";
  type?: "answer" | "fallback" | "support_ticket_created" | "error";
  faq_ids?: string[];
  confidence?: number;
  buttons?: { label: string; action: "message_recruiter" | "create_support_ticket" }[];
  ticket_id?: string;
};

export type MeetingType = "online" | "phone" | "in_person";
export type AppointmentStatus = "requested" | "confirmed" | "rescheduled" | "cancelled";

export type AppointmentSlot = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  meeting_type: MeetingType;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
};

export type Appointment = {
  id: string;
  slot_id: string | null;
  status: AppointmentStatus;
  meeting_type: MeetingType | null;
  confirmed_starts_at: string | null;
  confirmed_ends_at: string | null;
  meeting_link: string | null;
  location: string | null;
  reschedule_reason: string | null;
  requested_at: string;
  updated_at: string;
};

export type AttendanceStatus = "clocked_in" | "clocked_out";

export type AttendanceLog = {
  id: string;
  status: AttendanceStatus;
  attendance_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_address: string | null;
  clock_out_address: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_location_timestamp: string;
  clock_out_location_timestamp: string | null;
  clock_in_location_permission_status: string;
  clock_out_location_permission_status: string | null;
};

export type ApplicantNote = {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
};

export type ApplicantPortalTab = "schedule" | "notes";
