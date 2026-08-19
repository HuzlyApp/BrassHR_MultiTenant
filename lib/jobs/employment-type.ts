import type { EmploymentType } from "@/lib/jobs/types";

/** Employment types stored on workflow templates and onboarding flows. */
export const TEMPLATE_EMPLOYMENT_TYPES = ["W2", "1099", "RNR"] as const;
export type TemplateEmploymentType = (typeof TEMPLATE_EMPLOYMENT_TYPES)[number];

/**
 * Recruit and Release jobs historically stored `Contract`.
 * Templates and flows now use `RNR`; treat the two as aliases.
 */
export function isRnrEmploymentType(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim();
  return normalized === "RNR" || normalized === "Contract";
}

export function employmentTypesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  if (!a || !b) return a === b;
  if (a === b) return true;
  return isRnrEmploymentType(a) && isRnrEmploymentType(b);
}

export function employmentTypeDisplayLabel(type: string): string {
  if (isRnrEmploymentType(type)) return "RNR";
  return type;
}

export function employmentTypeFromLabel(label: string): EmploymentType {
  if (label === "RNR" || label === "R&R" || label === "Contract") return "Contract";
  if (label === "1099" || label === "W2") return label;
  return "W2";
}

export function normalizeTemplateEmploymentType(
  value: string | null | undefined
): TemplateEmploymentType | null {
  if (value === "W2" || value === "1099" || value === "RNR") return value;
  if (isRnrEmploymentType(value)) return "RNR";
  return null;
}
