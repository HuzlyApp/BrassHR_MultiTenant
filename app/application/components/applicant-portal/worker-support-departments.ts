export type WorkerSupportDepartment = {
  id: string;
  category: string;
  title: string;
  description: string;
  hoursLabel: string;
};

/** Support desk categories shown on the worker Departments tab (design). */
export const WORKER_SUPPORT_DEPARTMENTS: WorkerSupportDepartment[] = [
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

/** Rough online window for Mon–Sat 11:00–23:00 America/New_York. */
export function isWorkerSupportDeskOnline(now = new Date()): boolean {
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
