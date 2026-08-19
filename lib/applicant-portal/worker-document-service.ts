import type { SupabaseClient } from "@supabase/supabase-js";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";

export type WorkerDocumentUploaderRole = "Admin" | "Worker" | "";

export type WorkerDocumentListItem = {
  id: string;
  source: "portal" | "required" | "legacy";
  title: string;
  fileName: string;
  fileType: string | null;
  status: string;
  statusLabel: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  uploadedByUserId: string | null;
  uploadedByName: string;
  uploadedByRoleLabel: WorkerDocumentUploaderRole;
};

type PortalRow = {
  id: string;
  title: string;
  original_file_name: string | null;
  file_type?: string | null;
  status?: string | null;
  uploaded_at: string;
  storage_path?: string | null;
  file_url?: string | null;
};

type SubmittedRow = {
  id: string;
  required_document_id: string;
  original_file_name: string | null;
  file_type?: string | null;
  status?: string | null;
  uploaded_at: string;
  file_url?: string | null;
};

const LEGACY_DOCUMENT_FLAGS: Array<{ key: string; title: string }> = [
  { key: "nursing_license_url", title: "Nursing license" },
  { key: "tb_test_url", title: "TB test" },
  { key: "cpr_certification_url", title: "CPR certification" },
  { key: "drivers_license_url", title: "Driver's license" },
  { key: "document_url", title: "Uploaded document" },
];

const STAFF_ID_IN_ADMIN_PATH = /(?:^|\/)admin\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return [firstName, lastName].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
}

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleAlreadyListed(
  existing: Array<{ title: string; fileName: string }>,
  title: string
): boolean {
  const needle = normalizeTitle(title);
  if (!needle) return false;
  return existing.some((doc) => {
    const haystack = normalizeTitle(`${doc.title} ${doc.fileName}`);
    return haystack.includes(needle) || needle.includes(normalizeTitle(doc.title));
  });
}

export function documentUploaderRoleDisplay(role: WorkerDocumentUploaderRole): string {
  if (role === "Admin") return "Admin Recruiter";
  if (role === "Worker") return "Worker";
  return "";
}

export function inferUploaderFromStoragePath(path: string): {
  role: WorkerDocumentUploaderRole;
  userId: string | null;
} {
  const storagePath = asText(path);
  if (!storagePath) return { role: "Worker", userId: null };
  if (/(?:^|\/)admin\//i.test(storagePath)) {
    const staffId = storagePath.match(STAFF_ID_IN_ADMIN_PATH)?.[1] ?? null;
    return { role: "Admin", userId: staffId };
  }
  return { role: "Worker", userId: null };
}

export async function enrichDocumentUploaders<
  T extends {
    uploadedByUserId?: string | null;
    uploadedByRoleLabel?: WorkerDocumentUploaderRole;
  },
>(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string,
  items: T[]
): Promise<Array<T & { uploadedByName: string; uploadedByRoleLabel: WorkerDocumentUploaderRole }>> {
  if (items.length === 0) {
    return items.map((item) => ({
      ...item,
      uploadedByName: "Unknown",
      uploadedByRoleLabel: (item.uploadedByRoleLabel || "") as WorkerDocumentUploaderRole,
    }));
  }

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("user_id, first_name, last_name")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;

  const workerUserId = asText(worker?.user_id) || null;
  const workerDisplayName =
    formatPersonName(worker?.first_name as string | null, worker?.last_name as string | null) ||
    "Worker";

  const uploaderIds = [
    ...new Set(
      items
        .map((item) => asText(item.uploadedByUserId) || null)
        .filter((id): id is string => Boolean(id) && id !== workerUserId)
    ),
  ];
  const staffNamesById = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: staffRows, error: staffError } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .in("id", uploaderIds);
    if (staffError) throw staffError;
    for (const staff of staffRows ?? []) {
      const name = formatPersonName(staff.first_name, staff.last_name);
      staffNamesById.set(String(staff.id), name || "Recruiter");
    }
  }

  return items.map((item) => {
    const role = item.uploadedByRoleLabel === "Admin" ? "Admin" : "Worker";
    const uploaderId = asText(item.uploadedByUserId) || null;
    if (role === "Admin") {
      return {
        ...item,
        uploadedByName: (uploaderId && staffNamesById.get(uploaderId)) || "Recruiter",
        uploadedByRoleLabel: "Admin" as const,
      };
    }
    return { ...item, uploadedByName: workerDisplayName, uploadedByRoleLabel: "Worker" as const };
  });
}

export async function listWorkerDocumentsForApplicant(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<WorkerDocumentListItem[]> {
  const [portalRes, submittedRes, legacyRes] = await Promise.all([
    supabase
      .from("worker_portal_documents")
      .select("id, title, original_file_name, file_type, status, uploaded_at, storage_path, file_url")
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("worker_submitted_documents")
      .select(
        "id, required_document_id, original_file_name, file_type, status, uploaded_at, file_url"
      )
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("worker_documents")
      .select(
        "nursing_license_url, tb_test_url, cpr_certification_url, document_url, drivers_license_url, updated_at, document_name"
      )
      .eq("worker_id", workerId)
      .maybeSingle(),
  ]);

  if (portalRes.error) throw portalRes.error;
  if (submittedRes.error) throw submittedRes.error;
  if (legacyRes.error) {
    console.warn("[worker-documents] worker_documents", legacyRes.error);
  }

  const portalRows = (portalRes.data ?? []) as PortalRow[];
  const submittedRows = (submittedRes.data ?? []) as SubmittedRow[];

  const requiredIds = [...new Set(submittedRows.map((row) => row.required_document_id).filter(Boolean))];
  const requiredTitleById = new Map<string, string>();
  if (requiredIds.length > 0) {
    const { data: requiredRows, error: requiredError } = await supabase
      .from("tenant_required_documents")
      .select("id, title")
      .in("id", requiredIds);
    if (requiredError) throw requiredError;
    for (const row of requiredRows ?? []) {
      requiredTitleById.set(String(row.id), asText(row.title) || "Required document");
    }
  }

  const items: Array<
    Omit<WorkerDocumentListItem, "uploadedByName"> & { uploadedByUserId: string | null }
  > = [];

  for (const row of portalRows) {
    const inferred = inferUploaderFromStoragePath(asText(row.storage_path) || asText(row.file_url));
    items.push({
      id: row.id,
      source: "portal",
      title: asText(row.title) || "Document",
      fileName: asText(row.original_file_name) || asText(row.title) || "Document",
      fileType: row.file_type ?? null,
      status: asText(row.status) || "under_review",
      statusLabel: documentStatusLabel(asText(row.status) || "under_review"),
      uploadedAt: row.uploaded_at,
      uploadedAtLabel: formatUploadedAt(row.uploaded_at),
      uploadedByUserId: inferred.userId,
      uploadedByRoleLabel: inferred.role,
    });
  }

  for (const row of submittedRows) {
    const title = requiredTitleById.get(row.required_document_id) || "Required document";
    const inferred = inferUploaderFromStoragePath(asText(row.file_url));
    items.push({
      id: row.id,
      source: "required",
      title,
      fileName: asText(row.original_file_name) || title,
      fileType: row.file_type ?? null,
      status: asText(row.status) || "uploaded",
      statusLabel: documentStatusLabel(asText(row.status) || "uploaded"),
      uploadedAt: row.uploaded_at,
      uploadedAtLabel: formatUploadedAt(row.uploaded_at),
      uploadedByUserId: inferred.userId,
      uploadedByRoleLabel: inferred.role,
    });
  }

  if (legacyRes.data) {
    const docs = legacyRes.data as Record<string, unknown>;
    const updatedAt = asText(docs.updated_at) || new Date().toISOString();
    const documentName = asText(docs.document_name);
    for (const flag of LEGACY_DOCUMENT_FLAGS) {
      const fileUrl = asText(docs[flag.key]);
      if (!fileUrl) continue;
      if (titleAlreadyListed(items, flag.title)) continue;
      const inferred = inferUploaderFromStoragePath(fileUrl);
      items.push({
        id: `legacy-${flag.key}`,
        source: "legacy",
        title: flag.title,
        fileName: flag.key === "document_url" && documentName ? documentName : flag.title,
        fileType: null,
        status: "uploaded",
        statusLabel: documentStatusLabel("uploaded"),
        uploadedAt: updatedAt,
        uploadedAtLabel: formatUploadedAt(updatedAt),
        uploadedByUserId: inferred.userId,
        uploadedByRoleLabel: inferred.role,
      });
    }
  }

  const enriched = await enrichDocumentUploaders(supabase, workerId, tenantId, items);
  return enriched.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}
