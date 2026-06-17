import type { User } from "@supabase/supabase-js";
import type { StaffTenantScope } from "@/lib/auth/staff-tenant-scope";

export type FacilityTenantResolution = {
  tenantId: string;
  source: "worker" | "staff_scope" | "aligned";
};

export type ResolveFacilityTenantInput = {
  workerTenantId?: string | null;
  staffScope?: StaffTenantScope;
  staffUserId?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTenantId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Resolves the tenant used for facility create/list/assign flows.
 * Priority: worker/candidate tenant, validated against staff view-as scope when present.
 */
export function resolveFacilityTenantId(input: ResolveFacilityTenantInput): FacilityTenantResolution {
  const workerTenantId = normalizeTenantId(input.workerTenantId);
  const staffTenantId =
    input.staffScope?.mode === "scoped" ? normalizeTenantId(input.staffScope.tenantId) : null;

  if (workerTenantId && staffTenantId) {
    if (workerTenantId !== staffTenantId) {
      throw new Error(
        "Applicant tenant does not match your current tenant context. Switch tenant or select the correct applicant."
      );
    }
    return { tenantId: workerTenantId, source: "aligned" };
  }

  if (workerTenantId) {
    return { tenantId: workerTenantId, source: "worker" };
  }

  if (staffTenantId) {
    return { tenantId: staffTenantId, source: "staff_scope" };
  }

  throw new Error("Unable to determine tenant for facility operations.");
}

export function logFacilityTenantDebug(
  label: string,
  context: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[facilities:${label}]`, context);
}
