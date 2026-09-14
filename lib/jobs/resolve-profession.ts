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

async function findProfessionIdByName(
  supabase: DbClient,
  tenantId: string,
  name: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("professions")
    .select("id, tenant_id, name")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq("is_active", true);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; tenant_id: string | null; name: string }>;
  const tenantMatch = matchProfessionIdByName(
    rows.filter((row) => row.tenant_id === tenantId),
    name
  );
  if (tenantMatch) return tenantMatch;
  return matchProfessionIdByName(rows, name);
}

async function createTenantProfession(
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
  }

  throw lastError ?? new Error("Failed to save profession.");
}

export async function resolveProfessionIdForSave(
  supabase: DbClient,
  tenantId: string,
  input: Pick<JobRequisitionInput, "profession" | "professionId">
): Promise<string | null> {
  const name = clean(input.profession);
  if (name) {
    const existing = await findProfessionIdByName(supabase, tenantId, name);
    if (existing) return existing;
    return createTenantProfession(supabase, tenantId, name);
  }
  return clean(input.professionId);
}
