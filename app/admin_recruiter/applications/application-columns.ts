export type ApplicationColumnId =
  | "candidates"
  | "contact"
  | "matches"
  | "location"
  | "activity"
  | "currentStage"
  | "status"
  | "interest"
  | "email"
  | "workflow"
  | "dateApplied"
  | "evaluation"
  | "actions";

export const APPLICATION_COLUMN_OPTIONS: { id: ApplicationColumnId; label: string }[] = [
  { id: "candidates", label: "Candidate" },
  { id: "contact", label: "Contact" },
  { id: "matches", label: "Match %" },
  { id: "location", label: "Location" },
  { id: "activity", label: "Activity" },
  { id: "currentStage", label: "Current Stage" },
  { id: "status", label: "Status" },
  { id: "interest", label: "Interest" },
  { id: "email", label: "Email" },
  { id: "workflow", label: "Workflow" },
  { id: "dateApplied", label: "Application Date" },
  { id: "evaluation", label: "Evaluation" },
  { id: "actions", label: "Actions" },
];

/** Actions stays pinned on the right and is not hideable from Edit Columns. */
export const APPLICATION_EDITABLE_COLUMNS = APPLICATION_COLUMN_OPTIONS.filter(
  (column) => column.id !== "actions"
);

export const DEFAULT_APPLICATION_COLUMNS: ApplicationColumnId[] = [
  "candidates",
  "contact",
  "matches",
  "currentStage",
  "dateApplied",
  "evaluation",
  "status",
  "actions",
];

const STORAGE_KEY = "nexus-job-applications-list-columns-v2";

function insertAfter(
  order: ApplicationColumnId[],
  id: ApplicationColumnId,
  afterId: ApplicationColumnId
): ApplicationColumnId[] {
  if (order.includes(id)) return order;
  const afterIndex = order.indexOf(afterId);
  if (afterIndex >= 0) {
    const next = [...order];
    next.splice(afterIndex + 1, 0, id);
    return next;
  }
  const actionsIndex = order.indexOf("actions");
  if (actionsIndex >= 0) {
    const next = [...order];
    next.splice(actionsIndex, 0, id);
    return next;
  }
  return [...order, id];
}

function ensureDefaultListingColumns(order: ApplicationColumnId[]): ApplicationColumnId[] {
  let next = [...order];
  next = insertAfter(next, "contact", "candidates");
  next = insertAfter(next, "matches", "contact");
  next = insertAfter(next, "currentStage", "matches");
  next = insertAfter(next, "dateApplied", "currentStage");
  next = insertAfter(next, "evaluation", "dateApplied");
  if (!next.includes("status")) {
    const actionsIndex = next.indexOf("actions");
    if (actionsIndex >= 0) next.splice(actionsIndex, 0, "status");
    else next.push("status");
  }
  return next;
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
      ensureDefaultListingColumns(cleaned.length ? cleaned : [...DEFAULT_APPLICATION_COLUMNS])
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
  "evaluation",
  "actions",
]);

export function applicationListColumnClassName(colId: ApplicationColumnId): string {
  const center = CENTER_ALIGNED_COLUMNS.has(colId) ? " text-center" : "";
  if (colId === "candidates") return "min-w-[220px]";
  if (colId === "contact") return "min-w-[200px]";
  if (colId === "matches") return `min-w-[120px] max-w-[160px]${center}`;
  if (colId === "location") return "min-w-[120px] whitespace-nowrap";
  if (colId === "activity") return `min-w-[180px] whitespace-nowrap${center}`;
  if (colId === "currentStage") return "min-w-[170px]";
  if (colId === "interest") return `min-w-[132px] whitespace-nowrap${center}`;
  if (colId === "email") return `min-w-[180px]${center}`;
  if (colId === "workflow") return `min-w-[140px]${center}`;
  if (colId === "dateApplied") return `min-w-[140px] whitespace-nowrap${center}`;
  if (colId === "evaluation") return `min-w-[110px] whitespace-nowrap${center}`;
  if (colId === "status") return `min-w-[140px] whitespace-nowrap${center}`;
  if (colId === "actions") return `min-w-[100px] whitespace-nowrap${center}`;
  return center.trim();
}
