import type { SupabaseClient } from "@supabase/supabase-js";

type CountResult = { count: number; error: unknown | null };

async function headCount(
  supabase: SupabaseClient,
  table: string,
  apply: (q: ReturnType<SupabaseClient["from"]>) => ReturnType<SupabaseClient["from"]>,
): Promise<CountResult> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  q = apply(q) as typeof q;
  const { count, error } = await q;
  return { count: count ?? 0, error };
}

export async function countWorkersByTenant(
  supabase: SupabaseClient,
  tenantId: string,
  apply?: (q: ReturnType<SupabaseClient["from"]>) => ReturnType<SupabaseClient["from"]>,
): Promise<number> {
  const { count, error } = await headCount(supabase, "worker", (q) => {
    let next = q.eq("tenant_id", tenantId);
    return apply ? apply(next) : next;
  });
  if (error) throw error;
  return count;
}

export async function countWorkersCreatedBetween(
  supabase: SupabaseClient,
  tenantId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  return countWorkersByTenant(supabase, tenantId, (q) =>
    q.gte("created_at", startIso).lte("created_at", endIso),
  );
}

/** Count workers matching pipeline/legacy status labels (case variants). */
export async function countWorkersWithStatuses(
  supabase: SupabaseClient,
  tenantId: string,
  statuses: string[],
): Promise<number> {
  if (statuses.length === 0) return 0;
  const variants = statuses.flatMap((s) => [s, s.charAt(0).toUpperCase() + s.slice(1), s.toUpperCase()]);
  const unique = Array.from(new Set(variants));
  const { count, error } = await headCount(supabase, "worker", (q) =>
    q.eq("tenant_id", tenantId).or(`status.in.(${unique.join(",")}),worker_status.in.(${unique.join(",")})`),
  );
  if (error) throw error;
  return count;
}

export async function countTableByTenant(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  apply?: (q: ReturnType<SupabaseClient["from"]>) => ReturnType<SupabaseClient["from"]>,
): Promise<number> {
  const { count, error } = await headCount(supabase, table, (q) => {
    let next = q.eq("tenant_id", tenantId);
    return apply ? apply(next) : next;
  });
  if (error) throw error;
  return count;
}
