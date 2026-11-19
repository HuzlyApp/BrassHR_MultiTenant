export type SupportDepartment = {
  id: string;
  category: string;
  title: string;
  description: string;
  hoursLabel: string;
};

/** Support desk departments shown on Tickets → Departments (Figma). */
export const SUPPORT_DEPARTMENTS: SupportDepartment[] = [
  {
    id: "billing",
    category: "billing",
    title: "Billing",
    description: "Manages invoices and payment records while resolving billing issues.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
  {
    id: "general",
    category: "general",
    title: "General Inquiries",
    description: "Assists customers with common concerns and service information.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
  {
    id: "abuse",
    category: "abuse",
    title: "Report Abuse",
    description: "Allows users to report inappropriate, fraudulent, or abusive behavior.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
  {
    id: "refund",
    category: "refund",
    title: "Refund Cancellation",
    description: "Request refunds or cancel services according to policy terms.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
  {
    id: "dispute",
    category: "dispute",
    title: "File a Dispute",
    description: "Submit a claim for billing, service, or transaction issues.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
  {
    id: "others",
    category: "others",
    title: "Others",
    description: "For inquiries that don't fit existing support options.",
    hoursLabel: "Mon - Sat, 11:00 - 23:00 (USA)",
  },
];

export const SUPPORT_DEPARTMENT_CATEGORY_OPTIONS = SUPPORT_DEPARTMENTS.map((dept) => ({
  value: dept.category,
  label: dept.title,
}));

/** Rough online window for Mon–Sat 11:00–23:00 America/New_York. */
export function isSupportDeskOnline(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  if (weekday === "Sun") return false;
  return hour >= 11 && hour < 23;
}

export function getSupportDepartmentByCategory(category: string): SupportDepartment | undefined {
  const normalized = category.trim().toLowerCase();
  return SUPPORT_DEPARTMENTS.find((dept) => dept.category === normalized);
}
