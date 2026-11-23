import { FacilityValidationError } from "./errors";
import { parseRequiredUuid } from "@/lib/validation/uuid";
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

export async function assertApprovedFacilityWorker(supabase: SupabaseClient, tenantId: string, workerAuthId: string): Promise<void> {
  const { data: candidate, error } = await supabase.from("worker").select("id")
    .eq("tenant_id", tenantId).eq("user_id", workerAuthId).maybeSingle();
  if (error) throw error;
  if (!candidate?.id) throw new FacilityValidationError("Worker not found.", 404);
  const { data: worker, error: workerError } = await supabase.from("workers").select("id")
    .eq("tenant_id", tenantId).eq("candidate_id", candidate.id).eq("conversion_status", "converted").maybeSingle();
  if (workerError) throw workerError;
  if (!worker?.id) throw new FacilityValidationError("Approve as Worker before assigning this person to a facility.", 409);
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
    .neq("status", "cancelled")
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
  await assertApprovedFacilityWorker(supabase, tenantId, workerAuthId);
  const { data: facility, error: facilityError } = await supabase
    .from("facility")
    .select("id, tenant_id, client_id, name, address")
    .eq("id", facilityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (facilityError) throw facilityError;
  if (!facility?.id) {
    throw new Error("Facility not found.");
  }

  const { locationFromFreeText } = await import("@/lib/service-area/normalize");
  const { evaluateServiceAreaWithDb } = await import("@/lib/service-area/db");
  const { serviceAreaMessage } = await import("@/lib/service-area/copy");
  const { ServiceAreaDeniedError } = await import("@/lib/service-area/errors");
  const { fieldForDecision } = await import("@/lib/service-area/evaluate");
  const parsed = locationFromFreeText(facility.address);
  const decision = await evaluateServiceAreaWithDb(supabase, {
    tenantId,
    action: "update_worker_site",
    location: {
      country: "US",
      city: parsed.city,
      state: parsed.state,
      postalCode: parsed.postalCode,
      locationType: "onsite",
    },
  });
  if (!decision.allowed) {
    throw new ServiceAreaDeniedError({
      code: decision.reasonCode,
      messageKey: decision.messageKey,
      field: fieldForDecision("update_worker_site", decision),
      publicMessage: serviceAreaMessage(decision.messageKey),
    });
  }

  const { data: existingAssignments, error: assignmentLookupError } = await supabase
    .from("worker_shift_assignments")
    .select("id, shift_id, worker_id")
    .neq("status", "cancelled")
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
  const validationError = validateFacilityFormInput(input);
  if (validationError) throw new FacilityValidationError(validationError);
  if (options?.assignToWorkerAuthId) await assertApprovedFacilityWorker(supabase, tenantId, options.assignToWorkerAuthId);
  const { assertTenantCanOperate, evaluateServiceAreaWithDb } = await import("@/lib/service-area/db");
  await assertTenantCanOperate(supabase, tenantId);
  const { serviceAreaMessage } = await import("@/lib/service-area/copy");
  const { ServiceAreaDeniedError } = await import("@/lib/service-area/errors");
  const { fieldForDecision } = await import("@/lib/service-area/evaluate");
  const decision = await evaluateServiceAreaWithDb(supabase, {
    tenantId,
    action: "add_location",
    location: {
      country: "US",
      city: input.city,
      state: input.state,
      postalCode: input.zipCode,
      locationType: "onsite",
    },
  }, { createdBy: options?.staffUserId });
  if (!decision.allowed) {
    throw new ServiceAreaDeniedError({
      code: decision.reasonCode,
      messageKey: decision.messageKey,
      field: fieldForDecision("add_location", decision),
      publicMessage: serviceAreaMessage(decision.messageKey),
    });
  }

  const duplicate = await findDuplicateFacility(supabase, tenantId, input);
  if (duplicate) {
    return { duplicate: true, facility: duplicate };
  }

  const clientId = input.clientId!.trim();
  const { data: client, error: clientError } = await supabase.from("clients").select("id")
    .eq("tenant_id", tenantId).eq("id", clientId).maybeSingle();
  if (clientError) throw clientError;
  if (!client?.id) throw new FacilityValidationError("Choose a client organization from this tenant.");

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
  if (!parseRequiredUuid(input.clientId, "client organization").ok) return "Choose a client organization.";
  if (!input.name?.trim()) return "Facility name is required.";
  if (!input.streetAddress?.trim()) return "Street address is required.";
  if (!input.city?.trim()) return "City is required.";
  if (!input.state?.trim()) return "State is required.";
  if (!input.zipCode?.trim()) return "ZIP code is required.";
  if (!/^\d{5}(?:-\d{4})?$/.test(input.zipCode.trim())) return "Enter a valid 5-digit ZIP code or ZIP+4.";
  return null;
}

/** Cancel facility assignments while retaining their audit history and the shifts themselves. */
export async function unassignWorkerFromFacility(supabase: SupabaseClient, tenantId: string, facilityId: string, assignmentId: string): Promise<number> {
  const { data: assignment, error } = await supabase.from("worker_shift_assignments")
    .select("id, worker_id, shift_id").eq("tenant_id", tenantId).eq("id", assignmentId).maybeSingle();
  if (error) throw error;
  if (!assignment) throw new FacilityValidationError("Assignment not found.", 404);
  const { data: shifts, error: shiftError } = await supabase.from("shifts").select("id")
    .eq("tenant_id", tenantId).eq("facility_id", facilityId);
  if (shiftError) throw shiftError;
  const shiftIds = (shifts ?? []).map((shift) => String(shift.id));
  if (!shiftIds.includes(String(assignment.shift_id))) throw new FacilityValidationError("Assignment not found for this facility.", 404);
  const { data: cancelled, error: updateError } = await supabase.from("worker_shift_assignments")
    .update({ status: "cancelled" }).eq("tenant_id", tenantId).eq("worker_id", assignment.worker_id)
    .in("shift_id", shiftIds).neq("status", "cancelled").select("id");
  if (updateError) throw updateError;
  return cancelled?.length ?? 0;
}
