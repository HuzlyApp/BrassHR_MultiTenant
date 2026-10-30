import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DepartmentAssignmentKind,
  DepartmentRecord,
  DepartmentTarget,
} from "./types";

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type JobRow = {
  id: string;
  public_title: string | null;
  source_job_title: string | null;
  source_type: string | null;
  department_id: string | null;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department_id: string | null;
};

const NAME_MAX = 80;

export function normalizeDepartmentName(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function validateDepartmentName(value: unknown): string | null {
  const name = normalizeDepartmentName(value);
  if (!name) return "Enter a department name.";
  if (name.length > NAME_MAX) return `Department name must be ${NAME_MAX} characters or fewer.`;
  return null;
}

function jobLabel(row: JobRow): string {
  const source = String(row.source_type ?? "").trim().toLowerCase();
  if (source === "msp") {
    return row.source_job_title?.trim() || row.public_title?.trim() || "Untitled job";
  }
  return row.public_title?.trim() || row.source_job_title?.trim() || "Untitled job";
}

function candidateLabel(row: WorkerRow): string {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return name || row.email?.trim() || "Unnamed candidate";
}

function searchPattern(query: string): string {
  const cleaned = query.replace(/[%_\\,"]/g, "").trim();
  return `%${cleaned}%`;
}

async function loadNameMap(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", unique);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    names.set(row.id, row.name);
  }
  return names;
}

export async function listDepartments(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DepartmentRecord[]> {
  const [{ data: departments, error: departmentError }, { data: jobs, error: jobError }, { data: workers, error: workerError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, name, description, is_active")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
      supabase
        .from("job_requisitions")
        .select("department_id")
        .eq("tenant_id", tenantId)
        .not("department_id", "is", null),
      supabase
        .from("worker")
        .select("department_id")
        .eq("tenant_id", tenantId)
        .not("department_id", "is", null),
    ]);

  if (departmentError) throw departmentError;
  if (jobError) throw jobError;
  if (workerError) throw workerError;

  const jobCounts = new Map<string, number>();
  for (const row of (jobs ?? []) as Array<{ department_id: string | null }>) {
    if (!row.department_id) continue;
    jobCounts.set(row.department_id, (jobCounts.get(row.department_id) ?? 0) + 1);
  }
  const candidateCounts = new Map<string, number>();
  for (const row of (workers ?? []) as Array<{ department_id: string | null }>) {
    if (!row.department_id) continue;
    candidateCounts.set(row.department_id, (candidateCounts.get(row.department_id) ?? 0) + 1);
  }

  return ((departments ?? []) as DepartmentRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description?.trim() || null,
    isActive: row.is_active,
    jobCount: jobCounts.get(row.id) ?? 0,
    candidateCount: candidateCounts.get(row.id) ?? 0,
  }));
}

export async function createDepartment(
  supabase: SupabaseClient,
  tenantId: string,
  input: { name: string; description?: string | null }
): Promise<DepartmentRecord> {
  const nameError = validateDepartmentName(input.name);
  if (nameError) throw new Error(nameError);
  const name = normalizeDepartmentName(input.name);
  const description = input.description?.trim() || null;

  const { data, error } = await supabase
    .from("departments")
    .insert({
      tenant_id: tenantId,
      name,
      description,
    })
    .select("id, name, description, is_active")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A department with this name already exists.");
    throw error;
  }

  const row = data as DepartmentRow;
  return {
    id: row.id,
    name: row.name,
    description: row.description?.trim() || null,
    isActive: row.is_active,
    jobCount: 0,
    candidateCount: 0,
  };
}

export async function updateDepartment(
  supabase: SupabaseClient,
  tenantId: string,
  departmentId: string,
  input: { name?: string; description?: string | null; isActive?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name != null) {
    const nameError = validateDepartmentName(input.name);
    if (nameError) throw new Error(nameError);
    patch.name = normalizeDepartmentName(input.name);
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (typeof input.isActive === "boolean") {
    patch.is_active = input.isActive;
  }
  if (Object.keys(patch).length === 0) return;

  const { data, error } = await supabase
    .from("departments")
    .update(patch)
    .eq("id", departmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw new Error("A department with this name already exists.");
    throw error;
  }
  if (!data) throw new Error("Department not found.");

  if (typeof patch.name === "string") {
    const { error: labelError } = await supabase
      .from("job_requisitions")
      .update({ department: patch.name })
      .eq("tenant_id", tenantId)
      .eq("department_id", departmentId);
    if (labelError) throw labelError;
  }
}

export async function deleteDepartment(
  supabase: SupabaseClient,
  tenantId: string,
  departmentId: string
): Promise<void> {
  const [{ count: jobCount, error: jobError }, { count: candidateCount, error: candidateError }] =
    await Promise.all([
      supabase
        .from("job_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("department_id", departmentId),
      supabase
        .from("worker")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("department_id", departmentId),
    ]);
  if (jobError) throw jobError;
  if (candidateError) throw candidateError;
  if ((jobCount ?? 0) > 0 || (candidateCount ?? 0) > 0) {
    throw new Error("Remove this department from its jobs and candidates before deleting it.");
  }

  const { data, error } = await supabase
    .from("departments")
    .delete()
    .eq("id", departmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Department not found.");
}

async function requireDepartment(
  supabase: SupabaseClient,
  tenantId: string,
  departmentId: string
): Promise<DepartmentRow> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, description, is_active")
    .eq("id", departmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Department not found.");
  return data as DepartmentRow;
}

export async function listDepartmentAssignments(
  supabase: SupabaseClient,
  tenantId: string,
  departmentId: string
): Promise<{ jobs: DepartmentTarget[]; candidates: DepartmentTarget[] }> {
  const department = await requireDepartment(supabase, tenantId, departmentId);

  const [{ data: jobs, error: jobError }, { data: workers, error: workerError }] = await Promise.all([
    supabase
      .from("job_requisitions")
      .select("id, public_title, source_job_title, source_type, department_id")
      .eq("tenant_id", tenantId)
      .eq("department_id", departmentId)
      .order("public_title", { ascending: true })
      .limit(100),
    supabase
      .from("worker")
      .select("id, first_name, last_name, email, department_id")
      .eq("tenant_id", tenantId)
      .eq("department_id", departmentId)
      .order("last_name", { ascending: true })
      .limit(100),
  ]);
  if (jobError) throw jobError;
  if (workerError) throw workerError;

  return {
    jobs: ((jobs ?? []) as JobRow[]).map((row) => ({
      id: row.id,
      label: jobLabel(row),
      detail: null,
      departmentId,
      departmentName: department.name,
    })),
    candidates: ((workers ?? []) as WorkerRow[]).map((row) => ({
      id: row.id,
      label: candidateLabel(row),
      detail: row.email?.trim() || null,
      departmentId,
      departmentName: department.name,
    })),
  };
}

export async function searchDepartmentTargets(
  supabase: SupabaseClient,
  tenantId: string,
  kind: DepartmentAssignmentKind,
  query: string
): Promise<DepartmentTarget[]> {
  const pattern = searchPattern(query);
  if (pattern === "%%") return [];
  const quoted = `"${pattern}"`;

  if (kind === "job") {
    const { data, error } = await supabase
      .from("job_requisitions")
      .select("id, public_title, source_job_title, source_type, department_id")
      .eq("tenant_id", tenantId)
      .or(`public_title.ilike.${quoted},source_job_title.ilike.${quoted}`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const rows = (data ?? []) as JobRow[];
    const names = await loadNameMap(
      supabase,
      tenantId,
      rows.map((row) => row.department_id ?? "")
    );
    return rows.map((row) => ({
      id: row.id,
      label: jobLabel(row),
      detail: null,
      departmentId: row.department_id,
      departmentName: row.department_id ? names.get(row.department_id) ?? null : null,
    }));
  }

  const { data, error } = await supabase
    .from("worker")
    .select("id, first_name, last_name, email, department_id")
    .eq("tenant_id", tenantId)
    .or(`first_name.ilike.${quoted},last_name.ilike.${quoted},email.ilike.${quoted}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as WorkerRow[];
  const names = await loadNameMap(
    supabase,
    tenantId,
    rows.map((row) => row.department_id ?? "")
  );
  return rows.map((row) => ({
    id: row.id,
    label: candidateLabel(row),
    detail: row.email?.trim() || null,
    departmentId: row.department_id,
    departmentName: row.department_id ? names.get(row.department_id) ?? null : null,
  }));
}

export async function setDepartmentAssignment(
  supabase: SupabaseClient,
  tenantId: string,
  departmentId: string,
  kind: DepartmentAssignmentKind,
  targetId: string,
  assigned: boolean
): Promise<void> {
  const department = await requireDepartment(supabase, tenantId, departmentId);
  if (assigned && !department.is_active) {
    throw new Error("Activate this department before assigning it.");
  }

  if (kind === "job") {
    let query = supabase
      .from("job_requisitions")
      .update(assigned ? { department_id: departmentId } : { department_id: null, department: null })
      .eq("id", targetId)
      .eq("tenant_id", tenantId);
    if (!assigned) query = query.eq("department_id", departmentId);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(assigned ? "Job not found." : "That job is not in this department.");
    return;
  }

  let query = supabase
    .from("worker")
    .update({ department_id: assigned ? departmentId : null })
    .eq("id", targetId)
    .eq("tenant_id", tenantId);
  if (!assigned) query = query.eq("department_id", departmentId);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(assigned ? "Candidate not found." : "That candidate is not in this department.");
}
