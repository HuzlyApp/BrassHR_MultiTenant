export type ApplicationColumnId =
  | "candidates"
  | "matches"
  | "location"
  | "activity"
  | "status"
  | "interest"
  | "email"
  | "workflow"
  | "dateApplied"
  | "actions";

export const APPLICATION_COLUMN_OPTIONS: { id: ApplicationColumnId; label: string }[] = [
  { id: "candidates", label: "Name" },
  { id: "matches", label: "Match %" },
  { id: "location", label: "Location" },
  { id: "activity", label: "Activity" },
  { id: "status", label: "Status" },
  { id: "interest", label: "Interest" },
  { id: "email", label: "Email" },
  { id: "workflow", label: "Workflow" },
  { id: "dateApplied", label: "Date Applied" },
  { id: "actions", label: "Actions" },
];

/** Actions stays pinned on the right and is not hideable from Edit Columns. */
export const APPLICATION_EDITABLE_COLUMNS = APPLICATION_COLUMN_OPTIONS.filter(
  (column) => column.id !== "actions"
);

export const DEFAULT_APPLICATION_COLUMNS: ApplicationColumnId[] = [
  "candidates",
  "matches",
  "location",
  "activity",
  "status",
  "interest",
  "actions",
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

/** Insert Location after Match % for saved column prefs that predate the column. */
function ensureLocationAfterMatches(order: ApplicationColumnId[]): ApplicationColumnId[] {
  if (order.includes("location")) return order;
  const matchesIndex = order.indexOf("matches");
  if (matchesIndex >= 0) {
    const next = [...order];
    next.splice(matchesIndex + 1, 0, "location");
    return next;
  }
  return [...order, "location"];
}

/** Keep Actions last so the AI icon + menu stay on the far right. */
export function ensureActionsLast(order: ApplicationColumnId[]): ApplicationColumnId[] {
  return [...order.filter((id) => id !== "actions"), "actions"];
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
    return ensureActionsLast(
      ensureLocationAfterMatches(
        ensureStatusBeforeInterest(cleaned.length ? cleaned : [...DEFAULT_APPLICATION_COLUMNS])
      )
    );
  } catch {
    return [...DEFAULT_APPLICATION_COLUMNS];
  }
}

export function saveApplicationColumnOrder(order: ApplicationColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureActionsLast(order)));
  } catch {
    /* ignore quota */
  }
}

export function applicationColumnLabel(id: ApplicationColumnId): string {
  return APPLICATION_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id;
}

/** Name stays left; Location left-aligned; remaining list columns centered. */
const CENTER_ALIGNED_COLUMNS = new Set<ApplicationColumnId>([
  "matches",
  "activity",
  "interest",
  "status",
  "email",
  "workflow",
  "dateApplied",
  "actions",
]);

export function applicationListColumnClassName(colId: ApplicationColumnId): string {
  const center = CENTER_ALIGNED_COLUMNS.has(colId) ? " text-center" : "";
  if (colId === "candidates") return "min-w-[220px]";
  if (colId === "matches") return `min-w-[120px] max-w-[160px]${center}`;
  if (colId === "location") return "min-w-[120px] whitespace-nowrap";
  if (colId === "activity") return `min-w-[180px] whitespace-nowrap${center}`;
  if (colId === "interest") return `min-w-[132px] whitespace-nowrap${center}`;
  if (colId === "email") return `min-w-[180px]${center}`;
  if (colId === "workflow") return `min-w-[140px]${center}`;
  if (colId === "dateApplied") return `min-w-[120px] whitespace-nowrap${center}`;
  if (colId === "status") return `min-w-[140px] whitespace-nowrap${center}`;
  if (colId === "actions") return `min-w-[100px] whitespace-nowrap${center}`;
  return center.trim();
}
