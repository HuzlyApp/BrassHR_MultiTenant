import type { StepSettings } from "@/app/components/workflow-builder/types";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";

export const WORKFLOW_DATE_PRIORITY_OPTIONS = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 5",
  "Day 7",
] as const;

export const WORKFLOW_PROVIDER_OPTIONS = [
  "Checker (connected)",
  "Manual",
  "Third-party API",
] as const;

/** Parse scheduling day from settings label (e.g. "Day 3" → 3). */
export function dayFromDatePriority(datePriority: string | null | undefined): number {
  const m = /day\s*(\d+)/i.exec(String(datePriority ?? "").trim());
  if (!m) return 1;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Map numeric day to a known Date Priority label (falls back to `Day N`). */
export function dayToDatePriority(day: number): string {
  const known = WORKFLOW_DATE_PRIORITY_OPTIONS.find(
    (label) => dayFromDatePriority(label) === day
  );
  return known ?? `Day ${Math.max(1, Math.floor(day))}`;
}

/** Merge partial persisted settings with defaults; keep required/day in sync. */
export function normalizeWorkflowNodeSettings(
  raw: Partial<StepSettings> | null | undefined,
  opts?: { required?: boolean; day?: number }
): StepSettings {
  const merged: StepSettings = {
    ...DEFAULT_STEP_SETTINGS,
    ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}),
  };

  if (opts?.required !== undefined) {
    merged.required = opts.required;
  }

  if (opts?.day !== undefined) {
    merged.datePriority = dayToDatePriority(opts.day);
  }

  merged.required = opts?.required ?? merged.required;

  if (!WORKFLOW_DATE_PRIORITY_OPTIONS.includes(merged.datePriority as (typeof WORKFLOW_DATE_PRIORITY_OPTIONS)[number])) {
    const fromDay = dayFromDatePriority(merged.datePriority);
    merged.datePriority = dayToDatePriority(fromDay);
  }

  if (!merged.useBraasPartner && merged.provider === "Checker (connected)") {
    merged.provider = "Manual";
  }

  return merged;
}

export function schedulingDayFromStepMetadata(metadata: Record<string, unknown> | null | undefined): number {
  const rawDay = metadata?.workflow_day;
  if (typeof rawDay === "number" && Number.isFinite(rawDay) && rawDay > 0) {
    return Math.floor(rawDay);
  }
  const settings = metadata?.workflow_settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return dayFromDatePriority((settings as StepSettings).datePriority);
  }
  return 1;
}
