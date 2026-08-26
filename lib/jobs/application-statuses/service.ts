import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationPipelineStatus } from "@/lib/jobs/application-status";
import {
  activatePostHire,
  shouldActivatePostHireAfterStatusChange,
} from "@/lib/onboarding/activate-post-hire";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { shouldSuspendPostHireAfterStatusChange } from "@/lib/onboarding/lock-post-hire";
import { isPlacementAcceptedStatus } from "@/lib/onboarding/workflow-phase";
import {
  ApplicationStatusError,
  type ApplicationStatusHistoryRecord,
  type ApplicationStatusRecord,
  type ChangeApplicationStatusResult,
} from "./types";

type StatusRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  system_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  from_status_id: string | null;
  from_status_name: string | null;
  to_status_id: string | null;
  to_status_name: string;
  changed_by_user_id: string | null;
  note: string | null;
  created_at: string;
};

function mapStatus(row: StatusRow): ApplicationStatusRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isDefault: row.is_default,
    systemKey: (row.system_key as ApplicationStatusRecord["systemKey"]) ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureDefaultApplicationStatuses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { error } = await supabase.rpc("ensure_default_application_statuses", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
}

export async function listApplicationStatuses(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { activeOnly?: boolean; ensureDefaults?: boolean }
): Promise<ApplicationStatusRecord[]> {
  if (options?.ensureDefaults !== false) {
    await ensureDefaultApplicationStatuses(supabase, tenantId);
  }

  let query = supabase
    .from("application_statuses")
    .select(
      "id, tenant_id, name, description, color, sort_order, is_active, is_default, system_key, created_by, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as StatusRow[]).map(mapStatus);
}

/** Exact application counts keyed by status id (tenant-scoped). */
export async function countApplicationsByStatus(
  supabase: SupabaseClient,
  tenantId: string,
  statuses: ApplicationStatusRecord[]
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status_id", status.id);
      if (error) throw error;
      return [status.id, count ?? 0] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function getStatusBySystemKey(
  supabase: SupabaseClient,
  tenantId: string,
  systemKey: ApplicationPipelineStatus | "withdrawn"
): Promise<ApplicationStatusRecord | null> {
  await ensureDefaultApplicationStatuses(supabase, tenantId);
  const { data, error } = await supabase
    .from("application_statuses")
    .select(
      "id, tenant_id, name, description, color, sort_order, is_active, is_default, system_key, created_by, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("system_key", systemKey)
    .maybeSingle();
  if (error) throw error;
  return data ? mapStatus(data as StatusRow) : null;
}

export async function createApplicationStatus(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    name: string;
    description?: string | null;
    color?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
    createdBy?: string | null;
  }
): Promise<ApplicationStatusRecord> {
  const name = input.name.trim();
  if (!name) {
    throw new ApplicationStatusError("Status name is required", "VALIDATION");
  }

  if (input.isDefault) {
    await clearDefaultFlag(supabase, input.tenantId);
  }

  const maxSort = await nextSortOrder(supabase, input.tenantId);

  const { data, error } = await supabase
    .from("application_statuses")
    .insert({
      tenant_id: input.tenantId,
      name,
      description: input.description?.trim() || null,
      color: input.color?.trim() || null,
      sort_order: input.sortOrder ?? maxSort,
      is_active: input.isActive ?? true,
      is_default: input.isDefault ?? false,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, tenant_id, name, description, color, sort_order, is_active, is_default, system_key, created_by, created_at, updated_at"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApplicationStatusError("A status with this name already exists", "CONFLICT", 409);
    }
    throw error;
  }

  return mapStatus(data as StatusRow);
}

export async function updateApplicationStatus(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    statusId: string;
    name?: string;
    description?: string | null;
    color?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
  }
): Promise<ApplicationStatusRecord> {
  const existing = await getStatusOrThrow(supabase, input.tenantId, input.statusId);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ApplicationStatusError("Status name is required", "VALIDATION");
    patch.name = name;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.color !== undefined) {
    patch.color = input.color?.trim() || null;
  }
  if (input.sortOrder !== undefined) {
    patch.sort_order = input.sortOrder;
  }
  if (input.isActive !== undefined) {
    if (input.isActive === false && existing.isDefault) {
      throw new ApplicationStatusError(
        "Cannot deactivate the default status. Set another default first.",
        "VALIDATION"
      );
    }
    patch.is_active = input.isActive;
  }
  if (input.isDefault === true) {
    await clearDefaultFlag(supabase, input.tenantId, input.statusId);
    patch.is_default = true;
    patch.is_active = true;
  } else if (input.isDefault === false) {
    patch.is_default = false;
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("application_statuses")
    .update(patch)
    .eq("id", input.statusId)
    .eq("tenant_id", input.tenantId)
    .select(
      "id, tenant_id, name, description, color, sort_order, is_active, is_default, system_key, created_by, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new ApplicationStatusError("A status with this name already exists", "CONFLICT", 409);
    }
    throw error;
  }
  if (!data) throw new ApplicationStatusError("Status not found", "NOT_FOUND", 404);
  return mapStatus(data as StatusRow);
}

export async function reorderApplicationStatuses(
  supabase: SupabaseClient,
  tenantId: string,
  orderedIds: string[]
): Promise<ApplicationStatusRecord[]> {
  const statuses = await listApplicationStatuses(supabase, tenantId, { ensureDefaults: true });
  const idSet = new Set(statuses.map((s) => s.id));
  for (const id of orderedIds) {
    if (!idSet.has(id)) {
      throw new ApplicationStatusError("Unknown status in reorder list", "VALIDATION");
    }
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("application_statuses")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId)
    )
  );

  return listApplicationStatuses(supabase, tenantId, { ensureDefaults: false });
}

export async function changeApplicationStatus(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    applicationId: string;
    statusId: string;
    changedByUserId?: string | null;
    note?: string | null;
    origin?: string | null;
  }
): Promise<ChangeApplicationStatusResult> {
  const note =
    typeof input.note === "string" ? input.note.trim() || null : input.note ?? null;
  if (note && note.length > 4000) {
    throw new ApplicationStatusError("Note must be 4000 characters or fewer", "VALIDATION");
  }

  const { data, error } = await supabase.rpc("change_job_application_status", {
    p_tenant_id: input.tenantId,
    p_application_id: input.applicationId,
    p_to_status_id: input.statusId,
    p_changed_by_user_id: input.changedByUserId ?? null,
    p_note: note,
  });

  if (error) {
    const message = String(error.message ?? "");
    if (/Application not found|Status not found/i.test(message)) {
      throw new ApplicationStatusError(message, "NOT_FOUND", 404);
    }
    if (/inactive/i.test(message)) {
      throw new ApplicationStatusError("Status is inactive", "INACTIVE", 400);
    }
    if (/Note too long/i.test(message)) {
      throw new ApplicationStatusError("Note must be 4000 characters or fewer", "VALIDATION");
    }
    throw error;
  }

  const payload = data as {
    unchanged: boolean;
    application: {
      id: string;
      statusId: string;
      status: string;
      statusName: string;
    };
    history: null | {
      id: string;
      fromStatusId: string | null;
      fromStatusName: string | null;
      toStatusId: string;
      toStatusName: string;
      note: string | null;
      changedByUserId: string | null;
      changedAt: string;
    };
  };

  const result: ChangeApplicationStatusResult = {
    unchanged: Boolean(payload.unchanged),
    application: payload.application,
    history: payload.history
      ? {
          id: payload.history.id,
          fromStatus: {
            id: payload.history.fromStatusId,
            name: payload.history.fromStatusName,
          },
          toStatus: {
            id: payload.history.toStatusId,
            name: payload.history.toStatusName,
          },
          note: payload.history.note,
          changedByUserId: payload.history.changedByUserId,
          changedAt: payload.history.changedAt,
        }
      : null,
    postHire: null,
  };

  if (shouldActivatePostHireAfterStatusChange({
    unchanged: result.unchanged,
    status: result.application.status,
  })) {
    try {
      const postHire = await activatePostHire(supabase, {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        actorUserId: input.changedByUserId,
        origin: input.origin,
        sendEmail: Boolean(input.origin),
      });
      result.postHire = {
        activated: postHire.activated,
        alreadyActive: postHire.alreadyActive,
        phase: postHire.phase,
        emailSent: Boolean(postHire.email?.sent),
      };
    } catch (activationError) {
      console.error("[changeApplicationStatus] activatePostHire", activationError);
    }
  }

  if (
    shouldSuspendPostHireAfterStatusChange({
      previousStatus: result.history?.fromStatus.name,
      nextStatus: result.application.status,
      unchanged: result.unchanged,
    })
  ) {
    await writeActivityLog({
      actorUserId: input.changedByUserId ?? null,
      action: "post_hire.suspended",
      entityType: "job_application",
      entityId: input.applicationId,
      tenantId: input.tenantId,
      metadata: { status: result.application.status },
    });
  }

  if (!result.unchanged) {
    await writeActivityLog({
      actorUserId: input.changedByUserId ?? null,
      action: isPlacementAcceptedStatus(result.application.status)
        ? "application.hired"
        : "application.status_changed",
      entityType: "job_application",
      entityId: input.applicationId,
      tenantId: input.tenantId,
      metadata: {
        status: result.application.status,
        postHire: result.postHire,
      },
    });
  }

  return result;
}

export async function changeApplicationStatusBySystemKey(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    applicationId: string;
    systemKey: ApplicationPipelineStatus | "withdrawn";
    changedByUserId?: string | null;
    note?: string | null;
    origin?: string | null;
  }
): Promise<ChangeApplicationStatusResult> {
  const status = await getStatusBySystemKey(supabase, input.tenantId, input.systemKey);
  if (!status) {
    throw new ApplicationStatusError(
      `Status "${input.systemKey}" is not configured for this tenant`,
      "NOT_FOUND",
      404
    );
  }
  if (!status.isActive) {
    throw new ApplicationStatusError("Status is inactive", "INACTIVE", 400);
  }
  return changeApplicationStatus(supabase, {
    tenantId: input.tenantId,
    applicationId: input.applicationId,
    statusId: status.id,
    changedByUserId: input.changedByUserId,
    note: input.note,
    origin: input.origin,
  });
}

export async function listApplicationStatusHistory(
  supabase: SupabaseClient,
  input: { tenantId: string; applicationId: string }
): Promise<ApplicationStatusHistoryRecord[]> {
  const { data: app, error: appError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("id", input.applicationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (appError) throw appError;
  if (!app) throw new ApplicationStatusError("Application not found", "NOT_FOUND", 404);

  const { data, error } = await supabase
    .from("application_status_history")
    .select(
      "id, tenant_id, application_id, from_status_id, from_status_name, to_status_id, to_status_name, changed_by_user_id, note, created_at"
    )
    .eq("tenant_id", input.tenantId)
    .eq("application_id", input.applicationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as HistoryRow[];
  const userIds = Array.from(
    new Set(rows.map((r) => r.changed_by_user_id).filter((id): id is string => Boolean(id)))
  );

  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);
    for (const user of users ?? []) {
      const row = user as {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
      };
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      nameByUserId.set(row.id, fullName || row.email?.trim() || "Staff");
    }
  }

  return rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    tenantId: row.tenant_id,
    fromStatusId: row.from_status_id,
    fromStatusName: row.from_status_name,
    toStatusId: row.to_status_id,
    toStatusName: row.to_status_name,
    changedByUserId: row.changed_by_user_id,
    changedByName: row.changed_by_user_id
      ? nameByUserId.get(row.changed_by_user_id) ?? "Staff"
      : "System",
    note: row.note,
    createdAt: row.created_at,
  }));
}

async function getStatusOrThrow(
  supabase: SupabaseClient,
  tenantId: string,
  statusId: string
): Promise<ApplicationStatusRecord> {
  const { data, error } = await supabase
    .from("application_statuses")
    .select(
      "id, tenant_id, name, description, color, sort_order, is_active, is_default, system_key, created_by, created_at, updated_at"
    )
    .eq("id", statusId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApplicationStatusError("Status not found", "NOT_FOUND", 404);
  return mapStatus(data as StatusRow);
}

async function clearDefaultFlag(
  supabase: SupabaseClient,
  tenantId: string,
  exceptId?: string
): Promise<void> {
  let query = supabase
    .from("application_statuses")
    .update({ is_default: false })
    .eq("tenant_id", tenantId)
    .eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw error;
}

async function nextSortOrder(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const { data, error } = await supabase
    .from("application_statuses")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return ((data as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
}
