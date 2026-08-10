export type ApplicationColumnId =
  | "candidates"
  | "matches"
  | "activity"
  | "status"
  | "interest"
  | "email"
  | "workflow"
  | "dateApplied";

export const APPLICATION_COLUMN_OPTIONS: { id: ApplicationColumnId; label: string }[] = [
  { id: "candidates", label: "Name" },
  { id: "matches", label: "Matches to job post" },
  { id: "activity", label: "Activity" },
  { id: "status", label: "Status" },
  { id: "interest", label: "Interest" },
  { id: "email", label: "Email" },
  { id: "workflow", label: "Workflow" },
  { id: "dateApplied", label: "Date Applied" },
];

export const DEFAULT_APPLICATION_COLUMNS: ApplicationColumnId[] = [
  "candidates",
  "matches",
  "activity",
  "status",
  "interest",
];

const STORAGE_KEY = "nexus-job-applications-list-columns";

function ensureStatusBeforeInterest(order: ApplicationColumnId[]): ApplicationColumnId[] {
  if (order.includes("status")) return order;
  const interestIndex = order.indexOf("interest");
  if (interestIndex >= 0) {
    const next = [...order];
    next.splice(interestIndex, 0, "status");
    return next;
  }
  return [...order, "status"];
}

export function loadApplicationColumnOrder(): ApplicationColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_APPLICATION_COLUMNS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_APPLICATION_COLUMNS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_APPLICATION_COLUMNS];
    const allowed = new Set(APPLICATION_COLUMN_OPTIONS.map((c) => c.id));
    const cleaned = parsed.filter(
      (id): id is ApplicationColumnId =>
        typeof id === "string" && allowed.has(id as ApplicationColumnId)
    );
    return ensureStatusBeforeInterest(
      cleaned.length ? cleaned : [...DEFAULT_APPLICATION_COLUMNS]
    );
  } catch {
    return [...DEFAULT_APPLICATION_COLUMNS];
  }
}

export function saveApplicationColumnOrder(order: ApplicationColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota */
  }
}

export function applicationColumnLabel(id: ApplicationColumnId): string {
  return APPLICATION_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id;
}

/** Name stays left; all other list columns are centered (header + cell). */
const CENTER_ALIGNED_COLUMNS = new Set<ApplicationColumnId>([
  "matches",
  "activity",
  "interest",
  "status",
  "email",
  "workflow",
  "dateApplied",
]);

export function applicationListColumnClassName(colId: ApplicationColumnId): string {
  const center = CENTER_ALIGNED_COLUMNS.has(colId) ? " text-center" : "";
  if (colId === "candidates") return "min-w-[220px]";
  if (colId === "matches") return `min-w-[200px] max-w-[280px]${center}`;
  if (colId === "activity") return `min-w-[180px] whitespace-nowrap${center}`;
  if (colId === "interest") return `min-w-[160px] whitespace-nowrap${center}`;
  if (colId === "email") return `min-w-[180px]${center}`;
  if (colId === "workflow") return `min-w-[140px]${center}`;
  if (colId === "dateApplied") return `min-w-[120px] whitespace-nowrap${center}`;
  if (colId === "status") return `min-w-[140px] whitespace-nowrap${center}`;
  return center.trim();
}
