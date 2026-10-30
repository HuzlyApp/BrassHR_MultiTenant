export type CandidateDepartmentSource = "candidate" | "job";

export function resolvedCandidateDepartment(item: {
  direct_department_name?: string | null;
  application_department?: string | null;
}): { name: string | null; source: CandidateDepartmentSource | null } {
  const direct = item.direct_department_name?.trim() || "";
  if (direct) return { name: direct, source: "candidate" };
  const fromJob = item.application_department?.trim() || "";
  if (fromJob) return { name: fromJob, source: "job" };
  return { name: null, source: null };
}
