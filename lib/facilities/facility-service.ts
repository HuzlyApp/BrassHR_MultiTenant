import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFacilityAbout,
  formatFacilityAddress,
  normalizeAddressKey,
  normalizeFacilityName,
  parseContactPersonFromAbout,
  parseFacilityTypeFromAbout,
  parseMailingAddressFromAbout,
} from "./address";
import type {
  CreateFacilityResult,
  DuplicateFacilityResult,
  FacilityAssignmentsMeta,
  FacilityAssignmentsResponse,
  FacilityFormInput,
  FacilityListItem,
} from "./types";
import { logFacilityTenantDebug } from "./tenant-scope";

type FacilityRow = {
  id: string;
  tenant_id: string;
  client_id: string;
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

type AssignedFacilityMeta = {
  assignmentId: string;
  assignedAt: string;
  status: string;
};

function toListItem(
  facility: FacilityRow,
  extras?: Partial<AssignedFacilityMeta>
): FacilityListItem {
  return {
    id: facility.id,
    name: facility.name?.trim() || "Unnamed facility",
    primaryAddress: facility.address?.trim() || "",
    secondaryAddress: parseMailingAddressFromAbout(facility.about),
    distance: "",
    phone: facility.phone?.trim() || null,
    contactPerson: parseContactPersonFromAbout(facility.about) || null,
    facilityType: parseFacilityTypeFromAbout(facility.about) || null,
    assignedAt: extras?.assignedAt ?? null,
    assignmentId: extras?.assignmentId ?? null,
    assignmentStatus: extras?.status ?? null,
  };
}

async function resolveClientId(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

async function getTenantName(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data, error } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  return data?.name ? String(data.name) : null;
}

async function resolveClientUserId(
  supabase: SupabaseClient,
  tenantId: string,
  staffUserId?: string | null
): Promise<string | null> {
  const { data: existingClients, error: existingClientsError } = await supabase
    .from("clients")
    .select("user_id");
  if (existingClientsError) throw existingClientsError;

  const usedUserIds = new Set(
    ((existingClients ?? []) as { user_id?: string | null }[])
      .map((row) => String(row.user_id ?? "").trim())
      .filter(Boolean)
  );

  const { data: tenantUsers, error: tenantUsersError } = await supabase
    .from("users")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (tenantUsersError) throw tenantUsersError;

  const candidates = ((tenantUsers ?? []) as { id: string; role?: string | null }[]).filter(
    (user) => !usedUserIds.has(String(user.id))
  );

  if (staffUserId) {
    const staffCandidate = candidates.find((user) => user.id === staffUserId);
    if (staffCandidate) return staffCandidate.id;
  }

  const adminCandidate = candidates.find((user) => {
    const role = String(user.role ?? "").toLowerCase();
    return role === "admin" || role === "recruiter" || role === "manager";
  });
  if (adminCandidate) return adminCandidate.id;

  return candidates[0]?.id ?? null;
}

async function resolveOrCreateClientId(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { staffUserId?: string | null; facilityInput?: FacilityFormInput }
): Promise<string> {
  const existingClientId = await resolveClientId(supabase, tenantId);
  if (existingClientId) return existingClientId;

  const clientUserId = await resolveClientUserId(supabase, tenantId, options?.staffUserId);
  if (!clientUserId) {
    throw new Error(
      "Unable to provision a client record for this tenant. Add a tenant admin user before creating facilities."
    );
  }

  const tenantName = await getTenantName(supabase, tenantId);
  const companyName =
    options?.facilityInput?.name?.trim() || tenantName?.trim() || "Recruiter Managed Client";
  const address = options?.facilityInput ? formatFacilityAddress(options.facilityInput) : null;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenantId,
      user_id: clientUserId,
      company_name: companyName,
      address,
    })
    .select("id")
    .single();

  if (error) throw error;
  return String(data.id);
}

export async function findDuplicateFacility(
  supabase: SupabaseClient,
  tenantId: string,
  input: FacilityFormInput
): Promise<FacilityListItem | null> {
  const nameKey = normalizeFacilityName(input.name);
  const addressKey = normalizeAddressKey(formatFacilityAddress(input));
  if (!nameKey || !addressKey) return null;

  const { data, error } = await supabase
    .from("facility")
    .select("id, tenant_id, client_id, name, address, phone, about, created_at")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  for (const row of (data ?? []) as FacilityRow[]) {
    const rowName = normalizeFacilityName(row.name ?? "");
    const rowAddress = normalizeAddressKey(row.address ?? "");
    if (rowName === nameKey && rowAddress === addressKey) {
      return toListItem(row);
    }
  }

  return null;
}

async function resolveAssignedFacilityIdsForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  workerAuthId: string,
  workerTableId?: string
): Promise<Map<string, AssignedFacilityMeta>> {
  const workerIds = [...new Set([workerAuthId, workerTableId].filter(Boolean))] as string[];
  const activeByFacilityId = new Map<string, AssignedFacilityMeta>();
  if (workerIds.length === 0) return activeByFacilityId;

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("worker_shift_assignments")
    .select("id, shift_id, worker_id, assigned_at, status")
    .eq("tenant_id", tenantId)
    .in("worker_id", workerIds);
  if (assignmentError) throw assignmentError;

  const assignments = (assignmentRows ?? []) as AssignmentRow[];
  const shiftIds = [...new Set(assignments.map((row) => row.shift_id).filter(Boolean))];
  if (shiftIds.length === 0) return activeByFacilityId;

  const { data: shiftRows, error: shiftError } = await supabase
    .from("shifts")
    .select("id, facility_id")
    .eq("tenant_id", tenantId)
    .in("id", shiftIds);
  if (shiftError) throw shiftError;

  const shiftById = new Map<string, ShiftRow>();
  for (const shift of (shiftRows ?? []) as ShiftRow[]) {
    shiftById.set(shift.id, shift);
  }

  for (const assignment of assignments) {
    const shift = shiftById.get(assignment.shift_id);
    const facilityId = shift?.facility_id ? String(shift.facility_id) : "";
    if (!facilityId) continue;

    const existing = activeByFacilityId.get(facilityId);
    if (!existing || assignment.assigned_at > existing.assignedAt) {
      activeByFacilityId.set(facilityId, {
        assignmentId: assignment.id,
        assignedAt: assignment.assigned_at,
        status: assignment.status,
      });
    }
  }

  return activeByFacilityId;
}

export async function loadFacilityAssignmentsForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  workerAuthId: string,
  workerTableId?: string
): Promise<FacilityAssignmentsResponse> {
  const [{ data: facilityRows, error: facilityError }, activeByFacilityId] = await Promise.all([
    supabase
      .from("facility")
      .select("id, tenant_id, client_id, name, address, phone, about, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    resolveAssignedFacilityIdsForWorker(supabase, tenantId, workerAuthId, workerTableId),
  ]);

  if (facilityError) throw facilityError;

  logFacilityTenantDebug("load-assignments", {
    tenantId,
    workerAuthId,
    workerTableId: workerTableId ?? null,
    facilityCount: facilityRows?.length ?? 0,
    assignedFacilityCount: activeByFacilityId.size,
  });

  const facilities = (facilityRows ?? []) as FacilityRow[];
  const activeFacilityIds = new Set(activeByFacilityId.keys());

  const active: FacilityListItem[] = [];
  const potential: FacilityListItem[] = [];

  for (const facility of facilities) {
    const activeMeta = activeByFacilityId.get(facility.id);
    if (activeMeta) {
      active.push(toListItem(facility, activeMeta));
    } else {
      potential.push(toListItem(facility));
    }
  }

  active.sort((a, b) => String(b.assignedAt ?? "").localeCompare(String(a.assignedAt ?? "")));

  // Recent = assigned facilities for this candidate, latest assignment per facility, newest first.
  const recent = [...active];

  const assignedFacilityIds = [...activeFacilityIds];
  const meta: FacilityAssignmentsMeta = {
    tenantId,
    assignedFacilityIds,
    totalTenantFacilities: facilities.length,
    assignedCount: active.length,
    unassignedCount: potential.length,
  };

  logFacilityTenantDebug("load-assignments-result", {
    tenantId,
    assignedFacilityIds,
    totalTenantFacilities: meta.totalTenantFacilities,
    assignedCount: meta.assignedCount,
    unassignedCount: meta.unassignedCount,
    activeIds: active.map((item) => item.id),
    potentialIds: potential.map((item) => item.id),
    recentIds: recent.map((item) => item.id),
  });

  return { active, potential, recent, meta };
}

async function findOrCreateRecruitmentShift(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
  facilityId: string,
  facilityName: string
): Promise<string> {
  const { data: existingShifts, error: existingError } = await supabase
    .from("shifts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("facility_id", facilityId)
    .order("posted_at", { ascending: false })
    .limit(1);

  if (existingError) throw existingError;
  const existing = (existingShifts ?? [])[0] as { id?: string } | undefined;
  if (existing?.id) return String(existing.id);

  const { data: createdShift, error: createShiftError } = await supabase
    .from("shifts")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      facility_id: facilityId,
      title: `Recruitment placement - ${facilityName}`,
      description: "Auto-created for recruiter facility assignment",
    })
    .select("id")
    .single();

  if (createShiftError) throw createShiftError;
  return String(createdShift.id);
}

export async function assignFacilityToWorker(
  supabase: SupabaseClient,
  tenantId: string,
  workerAuthId: string,
  facilityId: string
): Promise<{ assignmentId: string; alreadyAssigned: boolean }> {
  const { data: facility, error: facilityError } = await supabase
    .from("facility")
    .select("id, tenant_id, client_id, name")
    .eq("id", facilityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (facilityError) throw facilityError;
  if (!facility?.id) {
    throw new Error("Facility not found.");
  }

  const { data: existingAssignments, error: assignmentLookupError } = await supabase
    .from("worker_shift_assignments")
    .select("id, shift_id, worker_id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerAuthId);

  if (assignmentLookupError) throw assignmentLookupError;

  const shiftIds = ((existingAssignments ?? []) as AssignmentRow[]).map((row) => row.shift_id);
  if (shiftIds.length > 0) {
    const { data: shiftRows, error: shiftError } = await supabase
      .from("shifts")
      .select("id, facility_id")
      .eq("tenant_id", tenantId)
      .in("id", shiftIds);
    if (shiftError) throw shiftError;

    const existing = ((shiftRows ?? []) as ShiftRow[]).find((row) => row.facility_id === facilityId);
    if (existing) {
      const assignment = ((existingAssignments ?? []) as AssignmentRow[]).find(
        (row) => row.shift_id === existing.id
      );
      if (assignment?.id) {
        return { assignmentId: assignment.id, alreadyAssigned: true };
      }
    }
  }

  const shiftId = await findOrCreateRecruitmentShift(
    supabase,
    tenantId,
    String(facility.client_id),
    facilityId,
    String(facility.name ?? "Facility")
  );

  const { data: createdAssignment, error: createAssignmentError } = await supabase
    .from("worker_shift_assignments")
    .insert({
      tenant_id: tenantId,
      shift_id: shiftId,
      worker_id: workerAuthId,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (createAssignmentError) throw createAssignmentError;
  return { assignmentId: String(createdAssignment.id), alreadyAssigned: false };
}

export async function createFacility(
  supabase: SupabaseClient,
  tenantId: string,
  input: FacilityFormInput,
  options?: { assignToWorkerAuthId?: string; staffUserId?: string | null }
): Promise<CreateFacilityResult | DuplicateFacilityResult> {
  const duplicate = await findDuplicateFacility(supabase, tenantId, input);
  if (duplicate) {
    return { duplicate: true, facility: duplicate };
  }

  const clientId = await resolveOrCreateClientId(supabase, tenantId, {
    staffUserId: options?.staffUserId,
    facilityInput: input,
  });

  const address = formatFacilityAddress(input);
  const about = buildFacilityAbout(input);
  const phone = input.phone?.trim() || null;

  logFacilityTenantDebug("create-facility", {
    tenantId,
    clientId,
    facilityName: input.name.trim(),
    assignToWorkerAuthId: options?.assignToWorkerAuthId ?? null,
  });

  const { data: facility, error: facilityError } = await supabase
    .from("facility")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      name: input.name.trim(),
      address,
      phone,
      about,
    })
    .select("id, name, address, phone, about, created_at")
    .single();

  if (facilityError) throw facilityError;

  let assigned = false;
  let assignmentId: string | undefined;

  if (options?.assignToWorkerAuthId) {
    const assignment = await assignFacilityToWorker(
      supabase,
      tenantId,
      options.assignToWorkerAuthId,
      String(facility.id)
    );
    assigned = true;
    assignmentId = assignment.assignmentId;
  }

  return {
    facility: facility as CreateFacilityResult["facility"],
    assigned,
    assignmentId,
  };
}

export function validateFacilityFormInput(input: FacilityFormInput): string | null {
  if (!input.name?.trim()) return "Facility name is required.";
  if (!input.streetAddress?.trim()) return "Street address is required.";
  if (!input.city?.trim()) return "City is required.";
  if (!input.state?.trim()) return "State is required.";
  if (!input.zipCode?.trim()) return "ZIP code is required.";
  return null;
}
