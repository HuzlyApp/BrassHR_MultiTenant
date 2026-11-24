import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchProfessionIdByName, professionCodeFromName } from "@/lib/jobs/profession-text";
import type { JobRequisitionInput } from "@/lib/jobs/types";

type DbClient = SupabaseClient;

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return String(error.message ?? "").toLowerCase().includes("duplicate");
}

async function tenantProfessionName(
  supabase: DbClient,
  tenantId: string,
  professionId: string | null,
  name: string | null
): Promise<string | null> {
  if (professionId) {
    const { data, error } = await supabase
      .from("tenant_professions")
      .select("name")
      .eq("id", professionId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data?.name) return String(data.name);
  }

  if (!name) return null;
  const { data, error } = await supabase
    .from("tenant_professions")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  const matchId = matchProfessionIdByName(rows, name);
  return rows.find((row) => row.id === matchId)?.name ?? null;
}

async function professionIdForTenantName(
  supabase: DbClient,
  tenantId: string,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("professions")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw error;
  return matchProfessionIdByName((data ?? []) as Array<{ id: string; name: string }>, name);
}

async function createProfessionForTenant(
  supabase: DbClient,
  tenantId: string,
  name: string
): Promise<string> {
  const base = professionCodeFromName(name);
  let lastError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = attempt === 0 ? base : `${base.slice(0, 32)}_${randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase
      .from("professions")
      .insert({
        tenant_id: tenantId,
        code,
        name,
        is_active: true,
      })
      .select("id")
      .single();
    if (!error && data?.id) return String(data.id);
    lastError = error;
    if (!isUniqueViolation(error)) break;
    const existing = await professionIdForTenantName(supabase, tenantId, name);
    if (existing) return existing;
  }

  throw lastError ?? new Error("Failed to save profession.");
}

async function existingProfessionId(
  supabase: DbClient,
  tenantId: string,
  professionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("professions")
    .select("id")
    .eq("id", professionId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

/**
 * The job form lists tenant_professions. job_requisitions.profession_id still
 * references professions, so a chosen tenant profession is stored as the
 * tenant's professions row with the same name.
 */
export async function resolveProfessionIdForSave(
  supabase: DbClient,
  tenantId: string,
  input: Pick<JobRequisitionInput, "profession" | "professionId">
): Promise<string | null> {
  const professionId = clean(input.professionId);
  const name = clean(input.profession);
  const tenantName = await tenantProfessionName(supabase, tenantId, professionId, name);
  if (tenantName) {
    const existing = await professionIdForTenantName(supabase, tenantId, tenantName);
    if (existing) return existing;
    return createProfessionForTenant(supabase, tenantId, tenantName);
  }

  if (professionId) return existingProfessionId(supabase, tenantId, professionId);
  return null;
}

/**
 * Map a stored professions.id (or name) back to the tenant_professions row the
 * job form / workflow mappings use, so edit/duplicate keep Profession selected.
 */
export async function resolveTenantProfessionForForm(
  supabase: DbClient,
  tenantId: string,
  input: { professionId?: string | null; professionName?: string | null }
): Promise<{ id: string; name: string } | null> {
  const professionId = clean(input.professionId);
  const nameHint = clean(input.professionName);

  if (professionId) {
    const { data: tenantHit, error: tenantError } = await supabase
      .from("tenant_professions")
      .select("id, name")
      .eq("id", professionId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (tenantHit?.id) {
      return { id: String(tenantHit.id), name: String(tenantHit.name ?? "").trim() || nameHint || "" };
    }
  }

  let resolvedName = nameHint;
  if (!resolvedName && professionId) {
    const { data: catalog, error: catalogError } = await supabase
      .from("professions")
      .select("name")
      .eq("id", professionId)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .maybeSingle();
    if (catalogError) throw catalogError;
    resolvedName = catalog?.name ? String(catalog.name).trim() : null;
  }
  if (!resolvedName) return null;

  const { data: rows, error } = await supabase
    .from("tenant_professions")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw error;
  const list = (rows ?? []) as Array<{ id: string; name: string }>;
  const matchId = matchProfessionIdByName(list, resolvedName);
  if (!matchId) return null;
  const row = list.find((item) => item.id === matchId);
  if (!row) return null;
  return { id: String(row.id), name: String(row.name).trim() || resolvedName };
}
