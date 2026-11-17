import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultLegalDocumentPayload } from "@/lib/legal/defaults";
import {
  SYSTEM_LEGAL_DOCUMENT_KEYS,
  slugifyLegalDocumentKey,
  type SystemLegalDocumentKey,
} from "@/lib/legal/document-keys";
import type { LegalDocumentRecord, LegalSection } from "@/lib/legal/types";
import type { CreateLegalDocumentInput, UpdateLegalDocumentInput } from "@/lib/legal/validation";

function normalizeSections(value: unknown): LegalSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => {
      if (!section || typeof section !== "object") return null;
      const row = section as { title?: unknown; paragraphs?: unknown };
      const title = typeof row.title === "string" ? row.title.trim() : "";
      const paragraphs = Array.isArray(row.paragraphs)
        ? row.paragraphs.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
        : [];
      if (!title || paragraphs.length === 0) return null;
      return { title, paragraphs };
    })
    .filter((section): section is LegalSection => section !== null);
}

function mapRow(row: Record<string, unknown>): LegalDocumentRecord {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    document_key: String(row.document_key),
    title: String(row.title),
    last_updated_label: typeof row.last_updated_label === "string" ? row.last_updated_label : null,
    audience: (row.audience as LegalDocumentRecord["audience"]) || "all",
    sections: normalizeSections(row.sections),
    is_system: row.is_system === true,
    is_published: row.is_published !== false,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function seedMissingSystemDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  actorUserId: string | null
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("legal_documents")
    .select("document_key")
    .eq("tenant_id", tenantId)
    .in("document_key", [...SYSTEM_LEGAL_DOCUMENT_KEYS]);

  if (error) throw error;

  const have = new Set((existing ?? []).map((row) => String((row as { document_key: string }).document_key)));
  const missing = SYSTEM_LEGAL_DOCUMENT_KEYS.filter((key) => !have.has(key));
  if (missing.length === 0) return;

  const rows = missing.map((key) => {
    const payload = getDefaultLegalDocumentPayload(key);
    return {
      tenant_id: tenantId,
      ...payload,
      created_by: actorUserId,
      updated_by: actorUserId,
    };
  });

  const { error: insertError } = await supabase.from("legal_documents").insert(rows);
  if (insertError && insertError.code !== "23505") throw insertError;
}

export async function listAdminLegalDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  actorUserId: string | null
): Promise<LegalDocumentRecord[]> {
  await seedMissingSystemDocuments(supabase, tenantId, actorUserId);

  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createAdminLegalDocument(
  supabase: SupabaseClient,
  tenantId: string,
  actorUserId: string | null,
  input: CreateLegalDocumentInput
): Promise<LegalDocumentRecord> {
  const key =
    input.document_key?.trim() ||
    slugifyLegalDocumentKey(input.title) ||
    `policy_${Date.now().toString(36)}`;

  if ((SYSTEM_LEGAL_DOCUMENT_KEYS as readonly string[]).includes(key)) {
    throw Object.assign(new Error("That document key is reserved for a system policy."), {
      status: 409,
      code: "SYSTEM_KEY_RESERVED",
    });
  }

  const { data: maxSort } = await supabase
    .from("legal_documents")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    typeof input.sort_order === "number"
      ? input.sort_order
      : (typeof (maxSort as { sort_order?: number } | null)?.sort_order === "number"
          ? Number((maxSort as { sort_order: number }).sort_order) + 10
          : 100);

  const { data, error } = await supabase
    .from("legal_documents")
    .insert({
      tenant_id: tenantId,
      document_key: key,
      title: input.title.trim(),
      last_updated_label: input.last_updated_label?.trim() || null,
      audience: input.audience,
      sections: input.sections,
      is_system: false,
      is_published: input.is_published ?? true,
      sort_order: nextSort,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw Object.assign(new Error("A policy with this key already exists for this tenant."), {
        status: 409,
        code: "DUPLICATE_KEY",
      });
    }
    throw error;
  }

  return mapRow(data as Record<string, unknown>);
}

export async function updateAdminLegalDocument(
  supabase: SupabaseClient,
  tenantId: string,
  actorUserId: string | null,
  input: UpdateLegalDocumentInput
): Promise<LegalDocumentRecord> {
  const patch: Record<string, unknown> = {
    updated_by: actorUserId,
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.last_updated_label !== undefined) {
    patch.last_updated_label = input.last_updated_label?.trim() || null;
  }
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.sections !== undefined) patch.sections = input.sections;
  if (input.is_published !== undefined) patch.is_published = input.is_published;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  const { data, error } = await supabase
    .from("legal_documents")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw Object.assign(new Error("Legal document not found."), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  return mapRow(data as Record<string, unknown>);
}

export async function deleteAdminLegalDocument(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<void> {
  const { data: existing, error: loadError } = await supabase
    .from("legal_documents")
    .select("id, is_system")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!existing) {
    throw Object.assign(new Error("Legal document not found."), {
      status: 404,
      code: "NOT_FOUND",
    });
  }
  if ((existing as { is_system?: boolean }).is_system === true) {
    throw Object.assign(new Error("System policies cannot be deleted. Unpublish or edit them instead."), {
      status: 400,
      code: "SYSTEM_LOCKED",
    });
  }

  const { error } = await supabase
    .from("legal_documents")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) throw error;
}

export async function resetAdminLegalDocumentToDefault(
  supabase: SupabaseClient,
  tenantId: string,
  actorUserId: string | null,
  documentKey: SystemLegalDocumentKey
): Promise<LegalDocumentRecord> {
  const payload = getDefaultLegalDocumentPayload(documentKey);
  const { data, error } = await supabase
    .from("legal_documents")
    .update({
      title: payload.title,
      last_updated_label: payload.last_updated_label,
      audience: payload.audience,
      sections: payload.sections,
      is_published: true,
      sort_order: payload.sort_order,
      updated_by: actorUserId,
    })
    .eq("tenant_id", tenantId)
    .eq("document_key", documentKey)
    .eq("is_system", true)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    await seedMissingSystemDocuments(supabase, tenantId, actorUserId);
    const { data: seeded, error: seededError } = await supabase
      .from("legal_documents")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("document_key", documentKey)
      .maybeSingle();
    if (seededError) throw seededError;
    if (!seeded) {
      throw Object.assign(new Error("Could not reset system policy."), {
        status: 404,
        code: "NOT_FOUND",
      });
    }
    return mapRow(seeded as Record<string, unknown>);
  }

  return mapRow(data as Record<string, unknown>);
}
