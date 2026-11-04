export type NotificationChannelTab = "in_app" | "push";

export type NotificationEventId =
  | "new_application"
  | "application_status_changed"
  | "interview_scheduled"
  | "interview_rescheduled_canceled"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "candidate_withdrawn"
  | "new_worker_onboarded"
  | "assignment_start_end"
  | "schedule_updates"
  | "clock_in_out_alerts"
  | "time_off_requests"
  | "no_show_late_alerts"
  | "certification_expiring"
  | "document_expiring"
  | "new_client_added"
  | "new_job_order"
  | "job_order_status_update"
  | "facility_updates"
  | "job_order_filled"
  | "job_order_canceled"
  | "client_message"
  | "contract_agreement_updates"
  | "certification_expiring_soon"
  | "background_check_completed"
  | "compliance_document_uploaded"
  | "i9_verification_completed";

export type NotificationCategoryId =
  | "recruitment"
  | "workers"
  | "client_orders"
  | "compliance";

export type NotificationCategoryDef = {
  id: NotificationCategoryId;
  title: string;
  description: string;
  events: Array<{ id: NotificationEventId; label: string }>;
};

export const NOTIFICATION_CATEGORIES: NotificationCategoryDef[] = [
  {
    id: "recruitment",
    title: "Recruitment & Candidates",
    description: "Alerts for applications, interviews, and offers.",
    events: [
      { id: "new_application", label: "New application received" },
      { id: "application_status_changed", label: "Application status changed" },
      { id: "interview_scheduled", label: "Interview Scheduled" },
      { id: "interview_rescheduled_canceled", label: "Interview rescheduled or canceled" },
      { id: "offer_sent", label: "Offer sent" },
      { id: "offer_accepted", label: "Offer accepted" },
      { id: "offer_declined", label: "Offer declined" },
      { id: "candidate_withdrawn", label: "Candidate withdrawn" },
    ],
  },
  {
    id: "workers",
    title: "Workers",
    description: "Onboarding, scheduling, attendance, and credential alerts.",
    events: [
      { id: "new_worker_onboarded", label: "New worker onboarded" },
      { id: "assignment_start_end", label: "Assignment start/end" },
      { id: "schedule_updates", label: "Schedule updates" },
      { id: "clock_in_out_alerts", label: "Clock-in/out alerts" },
      { id: "time_off_requests", label: "Time off requests" },
      { id: "no_show_late_alerts", label: "No show / late alerts" },
      { id: "certification_expiring", label: "Certification expiring" },
      { id: "document_expiring", label: "Document expiring" },
    ],
  },
  {
    id: "client_orders",
    title: "Client & Orders",
    description: "Client accounts, facilities, and job-order activity.",
    events: [
      { id: "new_client_added", label: "New client added" },
      { id: "new_job_order", label: "New job order" },
      { id: "job_order_status_update", label: "Job order status update" },
      { id: "facility_updates", label: "Facility updates" },
      { id: "job_order_filled", label: "Job order filled" },
      { id: "job_order_canceled", label: "Job order canceled" },
      { id: "client_message", label: "Client message" },
      { id: "contract_agreement_updates", label: "Contract or agreement updates" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Documents",
    description: "Compliance deadlines and verification updates.",
    events: [
      { id: "certification_expiring_soon", label: "Certification expiring soon" },
      { id: "background_check_completed", label: "Background check completed" },
      { id: "compliance_document_uploaded", label: "Compliance document uploaded" },
      { id: "i9_verification_completed", label: "I-9 verification completed" },
    ],
  },
];

export type ChannelEventPrefs = Record<NotificationEventId, boolean>;
export type ChannelCategoryEnabled = Record<NotificationCategoryId, boolean>;

export type NotificationChannelPrefs = {
  categoriesEnabled: ChannelCategoryEnabled;
  events: ChannelEventPrefs;
};

export type NotificationSettingsState = {
  inApp: NotificationChannelPrefs;
  push: NotificationChannelPrefs;
  emailDigest: boolean;
  pushEnabled: boolean;
  desktopPush: boolean;
  quietHoursEnabled: boolean;
  quietHoursFrom: string;
  quietHoursTo: string;
};

function defaultEvents(enabled: boolean): ChannelEventPrefs {
  const events = {} as ChannelEventPrefs;
  for (const category of NOTIFICATION_CATEGORIES) {
    for (const event of category.events) {
      events[event.id] = enabled;
    }
  }
  return events;
}

function defaultCategories(enabled: boolean): ChannelCategoryEnabled {
  return {
    recruitment: enabled,
    workers: enabled,
    client_orders: enabled,
    compliance: enabled,
  };
}

export function createDefaultNotificationSettings(): NotificationSettingsState {
  return {
    inApp: {
      categoriesEnabled: defaultCategories(true),
      events: defaultEvents(true),
    },
    push: {
      categoriesEnabled: defaultCategories(true),
      events: defaultEvents(true),
    },
    emailDigest: true,
    pushEnabled: true,
    desktopPush: true,
    quietHoursEnabled: false,
    quietHoursFrom: "22:00",
    quietHoursTo: "07:00",
  };
}

export const QUIET_HOUR_OPTIONS = [
  "00:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
] as const;

export function formatQuietHourLabel(value: string): string {
  const [hourRaw] = value.split(":");
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${period}`;
}

export const NOTIFICATION_SETTINGS_STORAGE_KEY = "brasshr.admin.notification-settings.v1";
