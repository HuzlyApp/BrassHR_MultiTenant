import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffTenantScope } from "@/lib/auth/staff-tenant-scope";

type Builder = {
  eq: (column: string, val: unknown) => unknown;
};

/** Apply tenant filter used by recruiter staff list endpoints (service-role client). */
export function applyWorkerTenantEq<T extends Builder>(query: T, scope: StaffTenantScope, column = "tenant_id"): T {
  if (scope.mode === "scoped") {
    return query.eq(column, scope.tenantId) as T;
  }
  return query;
}

/** Post-filter enrichment rows by tenant when upstream query could not include tenant_id equality. */
export async function narrowWorkerRowsByTenant(
  supabase: SupabaseClient,
  scope: StaffTenantScope,
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (scope.mode !== "scoped" || rows.length === 0) return rows;

  const ids = Array.from(
    new Set(
      rows.map((r) => (typeof r.id === "string" ? r.id : "")).filter((id) => id.length > 0)
    )
  );

  const { data, error } = await supabase
    .from("worker")
    .select("id")
    .in("id", ids)
    .eq("tenant_id", scope.tenantId);

  if (error || !Array.isArray(data)) {
    return rows;
  }
  const ok = new Set(data.map((d) => String((d as { id?: string }).id ?? "")));

  return rows.filter((r) => {
    const id = typeof r.id === "string" ? r.id : "";
    return id && ok.has(id);
  });
}
