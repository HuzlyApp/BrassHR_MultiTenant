import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DepartmentAssignmentKind,
  DepartmentRecord,
  DepartmentTarget,
} from "./types";

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
};

const CODE_MAX = 40;
const DESCRIPTION_MAX = 100;

export function normalizeDepartmentCode(value: unknown): string | null {
  const code = String(value ?? "").replace(/\s+/g, " ").trim();
  return code || null;
}

export function validateDepartmentCode(value: unknown): string | null {
  const code = normalizeDepartmentCode(value);
  if (!code) return "Enter a department number.";
  if (code.length > CODE_MAX) return `Department number must be ${CODE_MAX} characters or fewer.`;
  return null;
}

export function normalizeDepartmentDescription(value: unknown): string | null {
  const description = String(value ?? "").trim();
  return description || null;
}

export function validateDepartmentDescription(value: unknown): string | null {
  const description = String(value ?? "");
  if (description.length > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }
  return null;
}

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

function isMissingCodeColumn(error: unknown): boolean {
  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message)
      : error instanceof Error
        ? error.message
        : "";
  return /column .*code.* does not exist|Could not find the 'code' column/i.test(message);
}

export async function listDepartments(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DepartmentRecord[]> {
  const departmentsQuery = () =>
    supabase
      .from("departments")
      .select("id, name, code, description, is_active")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });
  const departmentsFallbackQuery = () =>
    supabase
      .from("departments")
      .select("id, name, description, is_active")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

  const [departmentsResult, jobsResult, workersResult] = await Promise.all([
    departmentsQuery(),
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

  let departments: Array<Record<string, unknown>> | null = (departmentsResult.data ??
    null) as Array<Record<string, unknown>> | null;
  let departmentError = departmentsResult.error;
  if (departmentError && isMissingCodeColumn(departmentError)) {
    const fallback = await departmentsFallbackQuery();
    departments = (fallback.data ?? null) as Array<Record<string, unknown>> | null;
    departmentError = fallback.error;
  }

  const { data: jobs, error: jobError } = jobsResult;
  const { data: workers, error: workerError } = workersResult;

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

  return (departments ?? []).map((row) => {
    const id = String(row.id);
    const description = typeof row.description === "string" ? row.description.trim() : null;
    const code = typeof row.code === "string" ? row.code.trim() || null : null;
    return {
      id,
      name: String(row.name ?? ""),
      code,
      description: description || null,
      isActive: Boolean(row.is_active),
      jobCount: jobCounts.get(id) ?? 0,
      candidateCount: candidateCounts.get(id) ?? 0,
    };
  });
}

export async function createDepartment(
  supabase: SupabaseClient,
  tenantId: string,
  input: { name: string; code?: string | null; description?: string | null }
): Promise<DepartmentRecord> {
  const nameError = validateDepartmentName(input.name);
  if (nameError) throw new Error(nameError);
  const codeError = validateDepartmentCode(input.code);
  if (codeError) throw new Error(codeError);
  const descriptionError = validateDepartmentDescription(input.description);
  if (descriptionError) throw new Error(descriptionError);
  const name = normalizeDepartmentName(input.name);
  const code = normalizeDepartmentCode(input.code);
  const description = normalizeDepartmentDescription(input.description);

  let insert = await supabase
    .from("departments")
    .insert({
      tenant_id: tenantId,
      name,
      code,
      description,
    })
    .select("id, name, code, description, is_active")
    .single();

  if (insert.error && isMissingCodeColumn(insert.error)) {
    insert = await supabase
      .from("departments")
      .insert({
        tenant_id: tenantId,
        name,
        description,
      })
      .select("id, name, description, is_active")
      .single();
  }

  if (insert.error) {
    if (insert.error.code === "23505") {
      const message = String(insert.error.message ?? "").toLowerCase();
      if (message.includes("code")) throw new Error("A department with this number already exists.");
      throw new Error("A department with this name already exists.");
    }
    throw insert.error;
  }

  const row = insert.data as Partial<DepartmentRow> & {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  };
  return {
    id: row.id,
    name: row.name,
    code: typeof row.code === "string" ? row.code.trim() || null : code,
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
  input: { name?: string; code?: string | null; description?: string | null; isActive?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name != null) {
    const nameError = validateDepartmentName(input.name);
    if (nameError) throw new Error(nameError);
    patch.name = normalizeDepartmentName(input.name);
  }
  if (input.code !== undefined) {
    const codeError = validateDepartmentCode(input.code);
    if (codeError) throw new Error(codeError);
    patch.code = normalizeDepartmentCode(input.code);
  }
  if (input.description !== undefined) {
    const descriptionError = validateDepartmentDescription(input.description);
    if (descriptionError) throw new Error(descriptionError);
    patch.description = normalizeDepartmentDescription(input.description);
  }
  if (typeof input.isActive === "boolean") {
    patch.is_active = input.isActive;
  }
  if (Object.keys(patch).length === 0) return;

  let update = await supabase
    .from("departments")
    .update(patch)
    .eq("id", departmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (update.error && isMissingCodeColumn(update.error) && "code" in patch) {
    const { code: _ignored, ...withoutCode } = patch;
    if (Object.keys(withoutCode).length === 0) return;
    update = await supabase
      .from("departments")
      .update(withoutCode)
      .eq("id", departmentId)
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();
  }

  if (update.error) {
    if (update.error.code === "23505") {
      const message = String(update.error.message ?? "").toLowerCase();
      if (message.includes("code")) throw new Error("A department with this number already exists.");
      throw new Error("A department with this name already exists.");
    }
    throw update.error;
  }
  if (!update.data) throw new Error("Department not found.");

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
  let result = await supabase
    .from("departments")
    .select("id, name, code, description, is_active")
    .eq("id", departmentId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (result.error && isMissingCodeColumn(result.error)) {
    result = await supabase
      .from("departments")
      .select("id, name, description, is_active")
      .eq("id", departmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
  }
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Department not found.");
  const row = result.data as Partial<DepartmentRow> & {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  };
  return {
    id: row.id,
    name: row.name,
    code: typeof row.code === "string" ? row.code : null,
    description: row.description,
    is_active: row.is_active,
  };
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
  const quoted = `"${pattern}"`;
  const hasQuery = pattern !== "%%";

  if (kind === "job") {
    let jobQuery = supabase
      .from("job_requisitions")
      .select("id, public_title, source_job_title, source_type, department_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (hasQuery) {
      jobQuery = jobQuery.or(`public_title.ilike.${quoted},source_job_title.ilike.${quoted}`);
    }
    const { data, error } = await jobQuery;
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

  let workerQuery = supabase
    .from("worker")
    .select("id, first_name, last_name, email, department_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (hasQuery) {
    workerQuery = workerQuery.or(
      `first_name.ilike.${quoted},last_name.ilike.${quoted},email.ilike.${quoted}`
    );
  }
  const { data, error } = await workerQuery;
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
