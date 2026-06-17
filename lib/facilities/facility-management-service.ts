import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFacilityTypeFromAbout } from "./address";
import { logFacilityTenantDebug } from "./tenant-scope";
import type { FacilityAssignedWorker, FacilityManagementItem, FacilitiesListResponse } from "./types";

type FacilityRow = {
  id: string;
  tenant_id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  about: string | null;
  created_at: string;
};

type ShiftRow = {
  id: string;
  facility_id: string | null;
};

type AssignmentRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  assigned_at: string;
  status: string;
};

type WorkerRow = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
};

async function loadAssignmentCountsByFacility(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, number>> {
  const { data: shiftRows, error: shiftError } = await supabase
    .from("shifts")
    .select("id, facility_id")
    .eq("tenant_id", tenantId);
  if (shiftError) throw shiftError;

  const shifts = (shiftRows ?? []) as ShiftRow[];
  const shiftIds = shifts.map((row) => row.id).filter(Boolean);
  if (shiftIds.length === 0) return new Map();

  const shiftToFacility = new Map<string, string>();
  for (const shift of shifts) {
    if (shift.facility_id) shiftToFacility.set(shift.id, String(shift.facility_id));
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("worker_shift_assignments")
    .select("id, shift_id, worker_id")
    .eq("tenant_id", tenantId)
    .in("shift_id", shiftIds);
  if (assignmentError) throw assignmentError;

  const counts = new Map<string, number>();
  const seen = new Map<string, Set<string>>();

  for (const assignment of (assignmentRows ?? []) as AssignmentRow[]) {
    const facilityId = shiftToFacility.get(assignment.shift_id);
    if (!facilityId) continue;

    const workerKey = String(assignment.worker_id);
    const facilityWorkers = seen.get(facilityId) ?? new Set<string>();
    if (facilityWorkers.has(workerKey)) continue;
    facilityWorkers.add(workerKey);
    seen.set(facilityId, facilityWorkers);
    counts.set(facilityId, (counts.get(facilityId) ?? 0) + 1);
  }

  return counts;
}

export async function loadFacilitiesForTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FacilitiesListResponse> {
  const [{ data: facilityRows, error: facilityError }, assignmentCounts] = await Promise.all([
    supabase
      .from("facility")
      .select("id, tenant_id, name, address, phone, about, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    loadAssignmentCountsByFacility(supabase, tenantId),
  ]);

  if (facilityError) throw facilityError;

  const facilities = ((facilityRows ?? []) as FacilityRow[]).map((row) => ({
    id: row.id,
    name: row.name?.trim() || "Unnamed facility",
    address: row.address?.trim() || null,
    phone: row.phone?.trim() || null,
    facilityType: parseFacilityTypeFromAbout(row.about) || null,
    createdAt: row.created_at,
    assignedCount: assignmentCounts.get(row.id) ?? 0,
  })) satisfies FacilityManagementItem[];

  logFacilityTenantDebug("load-facilities-for-tenant", {
    tenantId,
    facilityCount: facilities.length,
    withAssignments: facilities.filter((item) => item.assignedCount > 0).length,
  });

  return {
    facilities,
    meta: { tenantId, total: facilities.length },
  };
}

async function resolveWorkersByAssignmentIds(
  supabase: SupabaseClient,
  tenantId: string,
  workerIds: string[]
): Promise<Map<string, WorkerRow>> {
  if (workerIds.length === 0) return new Map();

  const uniqueIds = [...new Set(workerIds)];
  const { data: byUserId, error: byUserIdError } = await supabase
    .from("worker")
    .select("id, user_id, first_name, last_name, job_role, status, city, state")
    .eq("tenant_id", tenantId)
    .in("user_id", uniqueIds);
  if (byUserIdError) throw byUserIdError;

  const { data: byWorkerId, error: byWorkerIdError } = await supabase
    .from("worker")
    .select("id, user_id, first_name, last_name, job_role, status, city, state")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);
  if (byWorkerIdError) throw byWorkerIdError;

  const workerByKey = new Map<string, WorkerRow>();
  for (const worker of [...((byUserId ?? []) as WorkerRow[]), ...((byWorkerId ?? []) as WorkerRow[])]) {
    workerByKey.set(worker.id, worker);
    if (worker.user_id) workerByKey.set(String(worker.user_id), worker);
  }
  return workerByKey;
}

export async function loadAssignedWorkersForFacility(
  supabase: SupabaseClient,
  tenantId: string,
  facilityId: string
): Promise<FacilityAssignedWorker[]> {
  const { data: facility, error: facilityError } = await supabase
    .from("facility")
    .select("id")
    .eq("id", facilityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (facilityError) throw facilityError;
  if (!facility?.id) {
    throw new Error("Facility not found.");
  }

  const { data: shiftRows, error: shiftError } = await supabase
    .from("shifts")
    .select("id, facility_id")
    .eq("tenant_id", tenantId)
    .eq("facility_id", facilityId);
  if (shiftError) throw shiftError;

  const shiftIds = ((shiftRows ?? []) as ShiftRow[]).map((row) => row.id).filter(Boolean);
  if (shiftIds.length === 0) return [];

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("worker_shift_assignments")
    .select("id, shift_id, worker_id, assigned_at, status")
    .eq("tenant_id", tenantId)
    .in("shift_id", shiftIds)
    .order("assigned_at", { ascending: false });
  if (assignmentError) throw assignmentError;

  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const workerIds = assignments.map((row) => String(row.worker_id));
  const workerByKey = await resolveWorkersByAssignmentIds(supabase, tenantId, workerIds);

  const results: FacilityAssignedWorker[] = [];
  const seenWorkerIds = new Set<string>();

  for (const assignment of assignments) {
    const worker =
      workerByKey.get(String(assignment.worker_id)) ??
      [...workerByKey.values()].find((row) => row.id === assignment.worker_id);

    const workerId = worker?.id ?? String(assignment.worker_id);
    if (seenWorkerIds.has(workerId)) continue;
    seenWorkerIds.add(workerId);

    const city = worker?.city?.trim() || null;
    const state = worker?.state?.trim() || null;
    const location = [city, state].filter(Boolean).join(", ") || "—";

    results.push({
      workerId,
      assignmentId: assignment.id,
      assignedAt: assignment.assigned_at,
      assignmentStatus: assignment.status,
      firstName: worker?.first_name ?? null,
      lastName: worker?.last_name ?? null,
      jobRole: worker?.job_role ?? null,
      status: worker?.status ?? null,
      city,
      state,
      location,
    });
  }

  logFacilityTenantDebug("load-assigned-workers", {
    tenantId,
    facilityId,
    assignmentCount: results.length,
  });

  return results;
}

export function filterFacilitiesBySearch(
  facilities: FacilityManagementItem[],
  query: string
): FacilityManagementItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return facilities;

  return facilities.filter((facility) => {
    const haystack = [facility.name, facility.address, facility.facilityType, facility.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
