import type { SupabaseClient } from "@supabase/supabase-js";

export type CreateShiftInput = {
  facilityId?: string | null;
  workerId?: string | null;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  startHour?: number | null;
  endHour?: number | null;
  ratePerHour?: number | null;
  /** Explicit FSD mode; omitted by legacy callers. */
  isInternal?: boolean;
  clientId?: string | null;
  departmentId?: string | null;
  jobCategoryId?: string | null;
  numberOfPeopleNeeded?: number;
};

export async function createTenantShift(
  supabase: SupabaseClient,
  tenantId: string,
  input: CreateShiftInput
) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Shift title is required.");
  }
  if (!input.startDate) {
    throw new Error("Start date is required.");
  }

  const facilityId = input.facilityId?.trim() || null;
  let clientId: string | null = input.clientId ?? null;

  if (facilityId && input.isInternal === undefined) {
    const { data: facilityRow } = await supabase
      .from("facility")
      .select("id, client_id")
      .eq("tenant_id", tenantId)
      .eq("id", facilityId)
      .maybeSingle();

    if (facilityRow?.client_id) {
      clientId = String(facilityRow.client_id);
    }
  }

  if (!clientId && input.isInternal === undefined) {
    // Check if an existing client exists for this tenant
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    clientId = clientRow?.id ? String(clientRow.id) : null;
  }

  // Insert into public.shifts
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      facility_id: facilityId,
      title,
      description: input.description?.trim() || null,
      start_date: input.startDate,
      end_date: input.endDate || input.startDate,
      rate_per_hour: input.ratePerHour ?? null,
      ...(input.isInternal !== undefined ? {
        is_internal: input.isInternal,
        department_id: input.departmentId ?? null,
        job_category_id: input.jobCategoryId ?? null,
        number_of_people_needed: input.numberOfPeopleNeeded ?? 1,
      } : {}),
    })
    .select(input.isInternal !== undefined
      ? "id, title, description, start_date, end_date, facility_id, client_id, department_id, is_internal, job_category_id, number_of_people_needed, rate_per_hour"
      : "id, title, start_date, end_date, facility_id, client_id, rate_per_hour")
    .single<{ id: string } & Record<string, unknown>>();

  if (shiftError) {
    console.error("[createTenantShift] shift insert error:", shiftError);
    throw shiftError;
  }

  let assignment = null;
  const workerId = input.workerId?.trim();
  if (workerId && shift?.id) {
    const { data: assignData, error: assignError } = await supabase
      .from("worker_shift_assignments")
      .insert({
        tenant_id: tenantId,
        shift_id: shift.id,
        worker_id: workerId,
        status: "assigned",
      })
      .select("id, shift_id, worker_id, status, assigned_at")
      .single();

    if (assignError) {
      console.error("[createTenantShift] assignment error:", assignError);
    } else {
      assignment = assignData;
    }
  }

  return { shift, assignment };
}

