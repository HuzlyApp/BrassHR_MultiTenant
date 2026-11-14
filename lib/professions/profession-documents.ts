import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantOnboardingConfig, TenantRequiredDocument } from "@/lib/onboarding/types";

export const PROFESSION_DOCUMENT_KINDS = ["certificate", "license", "vaccination", "other"] as const;
export type ProfessionDocumentKind = (typeof PROFESSION_DOCUMENT_KINDS)[number];

/** Profession settings detail dropdown: Certificate and License only. */
export const SETTINGS_PROFESSION_DOCUMENT_KINDS = ["certificate", "license"] as const satisfies readonly ProfessionDocumentKind[];

const PROFESSION_DOCUMENT_KIND_LABELS: Record<ProfessionDocumentKind, string> = {
  certificate: "Certificate",
  license: "License",
  vaccination: "Vaccination",
  other: "Other",
};

/** Unified Documents table type tags (License / Certification / Resume / Other). */
export function unifiedDocumentTypeLabel(
  kind: ProfessionDocumentKind | "resume" | null | undefined
): string {
  if (kind === "resume") return "Resume";
  if (kind === "license") return "License";
  if (kind === "certificate") return "Certification";
  return "Other";
}

/** Applicant Documents tab sort: Resume → License → Certification → Other. */
export function unifiedDocumentTypeSortOrder(
  kind: ProfessionDocumentKind | "resume" | null | undefined
): number {
  if (kind === "resume") return 0;
  if (kind === "license") return 1;
  if (kind === "certificate") return 2;
  return 3;
}

export function isProfessionDocumentKind(value: unknown): value is ProfessionDocumentKind {
  return (PROFESSION_DOCUMENT_KINDS as readonly string[]).includes(String(value ?? ""));
}

export type ProfessionUploadDocument = {
  id: string;
  name: string;
  documentKind: ProfessionDocumentKind;
  isRequired: boolean;
  hasExpiration: boolean;
  sortOrder: number;
  /** Auth user who created the field; null/undefined means legacy / admin-owned. */
  createdBy?: string | null;
};

export type ProfessionUploadDraft = {
  id?: string | null;
  name: string;
  documentKind: ProfessionDocumentKind;
  isRequired: boolean;
  hasExpiration: boolean;
};

const NAME_MAX = 120;
const DOCUMENT_MAX = 40;
export const MAX_PROFESSION_DOCUMENT_FILES = 5;

export function professionDocumentKindLabel(kind: ProfessionDocumentKind): string {
  return PROFESSION_DOCUMENT_KIND_LABELS[kind];
}

export function normalizeProfessionDocumentDrafts(
  input: unknown
): { documents: ProfessionUploadDraft[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "Documents must be a list." };
  if (input.length > DOCUMENT_MAX) {
    return { error: `A profession can have at most ${DOCUMENT_MAX} documents.` };
  }

  const documents: ProfessionUploadDraft[] = [];
  const seen = new Set<string>();

  for (const row of input) {
    if (!row || typeof row !== "object") return { error: "Each document needs a name." };
    const record = row as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) return { error: "Document name is required." };
    if (name.length > NAME_MAX) return { error: "Document name must be 120 characters or fewer." };

    const kind = record.documentKind;
    if (!isProfessionDocumentKind(kind)) {
      return { error: "Each document must be a certificate, license, vaccination, or other." };
    }

    const key = name.toLowerCase();
    if (seen.has(key)) return { error: `“${name}” is listed more than once.` };
    seen.add(key);

    const id = typeof record.id === "string" ? record.id.trim() : "";
    documents.push({
      id: id && !id.startsWith("new-") ? id : null,
      name,
      documentKind: kind,
      isRequired: record.isRequired !== false,
      hasExpiration: record.hasExpiration === true,
    });
  }

  return { documents };
}

export function attachProfessionDocuments(
  config: TenantOnboardingConfig,
  documents: ProfessionUploadDocument[]
): TenantOnboardingConfig {
  const active = [...documents].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  if (!active.length) return config;

  const step =
    config.steps.find((item) => item.step_type === "professional_license") ??
    config.steps.find((item) => item.step_type === "document_upload");
  if (!step) return config;

  const mapped: TenantRequiredDocument[] = active.map((doc) => ({
    id: doc.id,
    onboarding_step_id: step.id,
    title: doc.name,
    description: professionDocumentKindLabel(doc.documentKind),
    is_required: doc.isRequired,
    sort_order: doc.sortOrder,
    accepted_file_types: ["pdf", "png", "jpg", "jpeg", "webp"],
    max_file_size_mb: 10,
    source: "profession",
    has_expiration: doc.hasExpiration,
  }));

  return {
    ...config,
    requiredDocuments: [
      ...config.requiredDocuments.filter((doc) => doc.onboarding_step_id !== step.id),
      ...mapped,
    ],
  };
}

type Db = SupabaseClient;

type ProfessionDocumentRow = {
  id: string;
  profession_id: string;
  name: string;
  document_kind: string;
  is_required: boolean;
  has_expiration?: boolean | null;
  sort_order: number;
  created_by?: string | null;
};

function mapRow(row: ProfessionDocumentRow): ProfessionUploadDocument {
  return {
    id: row.id,
    name: row.name,
    documentKind: isProfessionDocumentKind(row.document_kind) ? row.document_kind : "certificate",
    isRequired: row.is_required !== false,
    hasExpiration: row.has_expiration === true,
    sortOrder: row.sort_order,
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

const PROFESSION_DOCUMENT_SELECT =
  "id, profession_id, name, document_kind, is_required, has_expiration, sort_order, created_by";

const PROFESSION_DOCUMENT_SELECT_LEGACY =
  "id, profession_id, name, document_kind, is_required, has_expiration, sort_order";

async function selectProfessionDocumentRows(
  query: PromiseLike<{ data: unknown; error: { message?: string } | null }>
) {
  const result = await query;
  if (
    result.error &&
    /created_by/i.test(String(result.error.message ?? ""))
  ) {
    return null;
  }
  if (result.error) throw result.error;
  return (result.data ?? []) as ProfessionDocumentRow[];
}

export async function listProfessionDocuments(supabase: Db, tenantId: string) {
  let rows = await selectProfessionDocumentRows(
    supabase
      .from("tenant_profession_documents")
      .select(PROFESSION_DOCUMENT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  );
  if (!rows) {
    rows = await selectProfessionDocumentRows(
      supabase
        .from("tenant_profession_documents")
        .select(PROFESSION_DOCUMENT_SELECT_LEGACY)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    );
    if (!rows) throw new Error("Could not load profession documents.");
  }

  const byProfession = new Map<string, ProfessionUploadDocument[]>();
  for (const row of rows) {
    const list = byProfession.get(row.profession_id) ?? [];
    list.push(mapRow(row));
    byProfession.set(row.profession_id, list);
  }
  return byProfession;
}

export async function listActiveProfessionDocuments(
  supabase: Db,
  tenantId: string,
  professionId: string
): Promise<ProfessionUploadDocument[]> {
  let rows = await selectProfessionDocumentRows(
    supabase
      .from("tenant_profession_documents")
      .select(PROFESSION_DOCUMENT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("profession_id", professionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  );
  if (!rows) {
    rows = await selectProfessionDocumentRows(
      supabase
        .from("tenant_profession_documents")
        .select(PROFESSION_DOCUMENT_SELECT_LEGACY)
        .eq("tenant_id", tenantId)
        .eq("profession_id", professionId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    );
    if (!rows) throw new Error("Could not load profession documents.");
  }
  return rows.map(mapRow);
}

export async function readFlowProfessionId(
  supabase: Db,
  tenantId: string,
  flowId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("onboarding_flows")
    .select("profession_id")
    .eq("id", flowId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  const professionId = data?.profession_id ? String(data.profession_id) : "";
  return professionId || null;
}

export type SaveProfessionDocumentsOptions = {
  actorUserId?: string | null;
  actorIsAdmin?: boolean;
};

export async function saveProfessionDocuments(
  supabase: Db,
  tenantId: string,
  professionId: string,
  drafts: ProfessionUploadDraft[],
  options: SaveProfessionDocumentsOptions = {}
): Promise<ProfessionUploadDocument[]> {
  const actorUserId = options.actorUserId?.trim() || null;
  const actorIsAdmin = options.actorIsAdmin === true;

  const { data: profession, error: professionError } = await supabase
    .from("tenant_professions")
    .select("id")
    .eq("id", professionId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (professionError) throw professionError;
  if (!profession) throw new Error("Profession was not found for this organization.");

  let supportsCreatedBy = true;
  let existingRows: Array<{ id: string; created_by?: string | null }> = [];
  {
    const withCreatedBy = await supabase
      .from("tenant_profession_documents")
      .select("id, created_by")
      .eq("tenant_id", tenantId)
      .eq("profession_id", professionId)
      .eq("is_active", true);
    if (withCreatedBy.error && /created_by/i.test(withCreatedBy.error.message)) {
      supportsCreatedBy = false;
      const legacy = await supabase
        .from("tenant_profession_documents")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("profession_id", professionId)
        .eq("is_active", true);
      if (legacy.error) throw legacy.error;
      existingRows = (legacy.data ?? []).map((row) => ({ id: String(row.id) }));
    } else if (withCreatedBy.error) {
      throw withCreatedBy.error;
    } else {
      existingRows = (withCreatedBy.data ?? []).map((row) => ({
        id: String(row.id),
        created_by: row.created_by ? String(row.created_by) : null,
      }));
    }
  }

  const existingById = new Map(
    existingRows.map((row) => [row.id, row.created_by ?? null] as const)
  );

  const kept = new Set(drafts.map((doc) => doc.id).filter((id): id is string => Boolean(id)));
  const removed = [...existingById.keys()].filter((id) => !kept.has(id));

  if (!actorIsAdmin && removed.length) {
    const forbidden = removed.some((id) => existingById.get(id) !== actorUserId);
    if (forbidden || !actorUserId) {
      throw new Error("You can only delete license or certification fields that you added.");
    }
  }

  if (removed.length) {
    const { error } = await supabase
      .from("tenant_profession_documents")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .in("id", removed);
    if (error) throw error;
  }

  for (const [index, draft] of drafts.entries()) {
    const row = {
      name: draft.name,
      document_kind: draft.documentKind,
      is_required: draft.isRequired,
      has_expiration: draft.hasExpiration === true,
      sort_order: (index + 1) * 10,
      is_active: true,
    };
    if (draft.id) {
      const ownerId = existingById.get(draft.id) ?? null;
      if (!actorIsAdmin && ownerId !== actorUserId) {
        // Non-admins may keep admin/other fields in the payload, but not edit them.
        continue;
      }
      const { error } = await supabase
        .from("tenant_profession_documents")
        .update(row)
        .eq("id", draft.id)
        .eq("tenant_id", tenantId)
        .eq("profession_id", professionId);
      if (error) throw error;
    } else {
      const insertPayload = {
        ...row,
        tenant_id: tenantId,
        profession_id: professionId,
        ...(supportsCreatedBy && actorUserId ? { created_by: actorUserId } : {}),
      };
      const { error } = await supabase.from("tenant_profession_documents").insert(insertPayload);
      if (error) throw error;
    }
  }

  return listActiveProfessionDocuments(supabase, tenantId, professionId);
}

export async function savedWorkerProfessionId(
  supabase: Db,
  tenantId: string,
  workerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("job_applications")
    .select("tenant_profession_id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .not("tenant_profession_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.tenant_profession_id ? String(data.tenant_profession_id) : null;
}

export async function linkWorkerProfession(
  supabase: Db,
  tenantId: string,
  workerId: string,
  professionId: string
) {
  const savedProfessionId = await savedWorkerProfessionId(supabase, tenantId, workerId);
  if (savedProfessionId) {
    if (savedProfessionId === professionId) return;
    throw new Error("This candidate's profession is already saved and cannot be changed.");
  }

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (applicationError) throw applicationError;
  if (!application?.id) throw new Error("This candidate has no application to connect a profession to.");

  const { error } = await supabase
    .from("job_applications")
    .update({ tenant_profession_id: professionId })
    .eq("id", application.id)
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function countWorkerProfessionDocumentFiles(
  supabase: Db,
  tenantId: string,
  workerId: string,
  professionDocumentId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("worker_profession_document_uploads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .eq("profession_document_id", professionDocumentId);
  if (error) throw error;
  return count ?? 0;
}

export async function renameWorkerDocumentFile(
  supabase: Db,
  tenantId: string,
  workerId: string,
  input: {
    professionDocumentId?: string | null;
    professionUploadId?: string | null;
    submittedDocumentId?: string | null;
    fileName: string;
  }
) {
  const fileName = input.fileName.trim();
  if (!fileName) throw new Error("File name is required.");

  if (input.professionUploadId) {
    const { data, error } = await supabase
      .from("worker_profession_document_uploads")
      .update({ original_file_name: fileName })
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .eq("id", input.professionUploadId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return;
    if (!input.submittedDocumentId) throw new Error("Uploaded file was not found.");
  }

  if (input.professionDocumentId) {
    const { data: latest, error: latestError } = await supabase
      .from("worker_profession_document_uploads")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .eq("profession_document_id", input.professionDocumentId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    if (latest?.id) {
      const { error } = await supabase
        .from("worker_profession_document_uploads")
        .update({ original_file_name: fileName })
        .eq("id", latest.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return;
    }
    if (!input.submittedDocumentId) throw new Error("Uploaded file was not found.");
  }

  if (input.submittedDocumentId) {
    const { data, error } = await supabase
      .from("worker_submitted_documents")
      .update({ original_file_name: fileName })
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .eq("id", input.submittedDocumentId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error("Uploaded file was not found.");
    return;
  }

  throw new Error("Choose a document file to rename.");
}

/** Delete one uploaded file (not the document type catalog row). */
export async function deleteWorkerDocumentFile(
  supabase: Db,
  tenantId: string,
  workerId: string,
  input: {
    professionUploadId?: string | null;
    submittedDocumentId?: string | null;
  }
) {
  const worker = workerId.trim();
  if (!worker) throw new Error("Worker is required.");

  if (input.professionUploadId) {
    const { data, error } = await supabase
      .from("worker_profession_document_uploads")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("worker_id", worker)
      .eq("id", input.professionUploadId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return;
    if (!input.submittedDocumentId) throw new Error("Uploaded file was not found.");
  }

  if (input.submittedDocumentId) {
    const { data, error } = await supabase
      .from("worker_submitted_documents")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("worker_id", worker)
      .eq("id", input.submittedDocumentId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error("Uploaded file was not found.");
    return;
  }

  throw new Error("Choose a document file to delete.");
}
