import type { SupabaseClient } from "@supabase/supabase-js";

type DepartmentRow = { id: string; name: string | null };

/**
 * Fills direct candidate departments onto list rows.
 * A missing department column is ignored so the list still loads before the migration.
 */
export async function attachDirectCandidateDepartments(
  supabase: SupabaseClient,
  rows: Array<Record<string, unknown>>
): Promise<void> {
  const ids = rows
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter(Boolean);
  if (ids.length === 0) return;

  const { data: workers, error: workerError } = await supabase
    .from("worker")
    .select("id, department_id")
    .in("id", ids);
  if (workerError || !workers) return;

  const departmentIds = [
    ...new Set(
      (workers as Array<{ department_id?: string | null }>)
        .map((row) => (typeof row.department_id === "string" ? row.department_id : ""))
        .filter(Boolean)
    ),
  ];
  if (departmentIds.length === 0) return;

  const { data: departments, error: departmentError } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", departmentIds);
  if (departmentError || !departments) return;

  const names = new Map<string, string>();
  for (const row of departments as DepartmentRow[]) {
    const name = row.name?.trim() || "";
    if (name) names.set(row.id, name);
  }

  const byWorker = new Map<string, string>();
  for (const row of workers as Array<{ id?: string; department_id?: string | null }>) {
    const workerId = typeof row.id === "string" ? row.id : "";
    const departmentId = typeof row.department_id === "string" ? row.department_id : "";
    const name = names.get(departmentId);
    if (workerId && name) byWorker.set(workerId, name);
  }

  for (const row of rows) {
    const workerId = typeof row.id === "string" ? row.id : "";
    const name = byWorker.get(workerId);
    if (name) row.direct_department_name = name;
  }
}
