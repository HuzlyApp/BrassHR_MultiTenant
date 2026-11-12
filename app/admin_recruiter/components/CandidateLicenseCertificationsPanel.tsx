"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import BrandedDeleteIcon from "@/app/admin_recruiter/components/BrandedDeleteIcon";
import BrandedEditIcon from "@/app/admin_recruiter/components/BrandedEditIcon";
import AddLicenseCertModal, {
  type LicenseCertFormValues,
  type LicenseCertKind,
} from "@/app/admin_recruiter/components/AddLicenseCertModal";
import { BulkDeleteConfirmModal } from "@/app/admin_recruiter/components/BulkDeleteConfirmModal";
import {
  fetchStaffDetailJson,
  invalidateStaffDetailCache,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import { useAdminHeaderData } from "@/lib/admin/hooks/use-admin-header-data";
import type { ProfessionDocumentKind } from "@/lib/professions/profession-documents";

type AttachmentRequirement = {
  id: string;
  title: string;
  url: string | null;
  filename: string;
  required_document_id?: string | null;
  status?: string | null;
  document_kind?: ProfessionDocumentKind | null;
  has_expiration?: boolean;
  issued_date?: string | null;
  expiry_date?: string | null;
  issuing_organization?: string | null;
  scope?: string | null;
  validity?: string | null;
  uploaded_by?: string | null;
  files?: Array<{
    id: string;
    url: string | null;
    filename: string;
    uploaded_by?: string | null;
  }>;
};

type CredentialRow = {
  id: string;
  required_document_id: string;
  license_name: string;
  issuing_organization: string | null;
  scope: string | null;
  validity: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  original_file_name: string | null;
};

type SettingsDocument = {
  id: string;
  name: string;
  documentKind: ProfessionDocumentKind;
  isRequired: boolean;
  hasExpiration: boolean;
};

type SettingsCatalog = {
  canManage: boolean;
  workerProfessionId: string | null;
  savedProfessionId: string | null;
  professions: Array<{
    id: string;
    name: string;
    documents: SettingsDocument[];
  }>;
};

type DisplayRow = {
  key: string;
  kind: LicenseCertKind;
  title: string;
  requiredDocumentId: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  hasExpiration: boolean;
  scope: string | null;
  issuingOrganization: string | null;
  validity: string | null;
  documentUrl: string | null;
  filename: string | null;
  uploadedBy: string | null;
};

type LocalMeta = {
  issuedDate?: string | null;
  expiryDate?: string | null;
  hasExpiration?: boolean;
  scope?: string | null;
  issuingOrganization?: string | null;
  validity?: string | null;
  documentUrl?: string | null;
  filename?: string | null;
  uploadedBy?: string | null;
};

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(`${iso.trim()}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "—";
}

function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export default function CandidateLicenseCertificationsPanel({
  workerId,
}: {
  workerId: string;
}) {
  const { displayName: currentUserName, roleLabel: currentUserRoleLabel } =
    useAdminHeaderData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<AttachmentRequirement[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [settings, setSettings] = useState<SettingsCatalog | null>(null);
  const [modalKind, setModalKind] = useState<LicenseCertKind | null>(null);
  const [editing, setEditing] = useState<DisplayRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DisplayRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [localMetaByName, setLocalMetaByName] = useState<Record<string, LocalMeta>>({});

  const fetchSnapshot = useCallback(async () => {
    invalidateStaffDetailCache(workerId);
    const bust = `t=${Date.now()}`;
    const profileUrl = `${workerProfileApiUrl(workerId)}&${bust}`;
    const [profileResult, settingsRes, credentialsRes] = await Promise.all([
      fetchStaffDetailJson<{
        attachment_requirements?: AttachmentRequirement[];
        error?: string;
      }>(profileUrl, { bust: true }),
      fetch(
        `/api/admin/profession-documents?workerId=${encodeURIComponent(workerId)}&${bust}`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/admin/worker-credentials?workerId=${encodeURIComponent(workerId)}&${bust}`,
        { cache: "no-store" }
      ),
    ]);

    if (!profileResult.ok) {
      throw new Error(profileResult.payload.error || "Could not load documents.");
    }

    const settingsPayload = (await settingsRes.json()) as SettingsCatalog & {
      error?: string;
    };
    if (!settingsRes.ok) {
      throw new Error(settingsPayload.error || "Could not load document settings.");
    }

    const credentialsPayload = (await credentialsRes.json().catch(() => ({}))) as {
      credentials?: CredentialRow[];
      error?: string;
    };
    if (!credentialsRes.ok) {
      throw new Error(credentialsPayload.error || "Could not load credentials.");
    }

    return {
      requirements: profileResult.payload.attachment_requirements ?? [],
      settings: settingsPayload,
      credentials: credentialsPayload.credentials ?? [],
    };
  }, [workerId]);

  const applySnapshot = useCallback(
    (snapshot: {
      requirements: AttachmentRequirement[];
      settings: SettingsCatalog;
      credentials: CredentialRow[];
    }) => {
      setRequirements(snapshot.requirements);
      setSettings(snapshot.settings);
      setCredentials(snapshot.credentials);
    },
    []
  );

  const load = useCallback(async () => {
    setError(null);
    const snapshot = await fetchSnapshot();
    applySnapshot(snapshot);
    return snapshot;
  }, [applySnapshot, fetchSnapshot]);

  const reloadAfterMutation = useCallback(
    async (expectedName?: string) => {
      const expectedKey = expectedName ? nameKey(expectedName) : null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const snapshot = await fetchSnapshot();
          if (!expectedKey) {
            applySnapshot(snapshot);
            return;
          }
          const inSettings = (snapshot.settings.professions ?? []).some((profession) =>
            profession.documents.some(
              (document) =>
                (document.documentKind === "license" ||
                  document.documentKind === "certificate") &&
                nameKey(document.name) === expectedKey
            )
          );
          const inRequirements = snapshot.requirements.some(
            (row) =>
              (row.document_kind === "license" || row.document_kind === "certificate") &&
              nameKey(row.title) === expectedKey
          );
          if (inSettings || inRequirements) {
            applySnapshot(snapshot);
            return;
          }
          // Keep optimistic UI if the API is still lagging.
        } catch (err) {
          lastError = err;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
      if (lastError) throw lastError;
    },
    [applySnapshot, fetchSnapshot]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void load()
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load licenses.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const professionId =
    settings?.savedProfessionId || settings?.workerProfessionId || "";
  const selectedProfession =
    settings?.professions.find((profession) => profession.id === professionId) ?? null;

  const rows = useMemo(() => {
    const credentialByName = new Map(
      credentials.map((row) => [nameKey(row.license_name), row] as const)
    );
    const requirementByDocId = new Map<string, AttachmentRequirement>();
    const requirementByName = new Map<string, AttachmentRequirement>();
    for (const row of requirements) {
      if (row.document_kind !== "license" && row.document_kind !== "certificate") continue;
      if (row.required_document_id) {
        requirementByDocId.set(row.required_document_id, row);
      }
      requirementByName.set(nameKey(row.title), row);
    }

    // Profession settings are the source of truth for add/edit; enrich with uploads.
    const fromSettings: DisplayRow[] = (selectedProfession?.documents ?? [])
      .filter(
        (document) =>
          document.documentKind === "license" || document.documentKind === "certificate"
      )
      .map((document) => {
        const key = nameKey(document.name);
        const requirement =
          (document.id ? requirementByDocId.get(document.id) : undefined) ||
          requirementByName.get(key);
        const credential = credentialByName.get(key);
        const local = localMetaByName[key];
        const fileUrl =
          local?.documentUrl ||
          requirement?.files?.find((file) => file.url)?.url ||
          requirement?.url ||
          credential?.document_url ||
          null;
        const filename =
          local?.filename ||
          requirement?.files?.find((file) => file.filename)?.filename ||
          (requirement?.filename && requirement.filename !== "—"
            ? requirement.filename
            : null) ||
          credential?.original_file_name ||
          null;
        const uploadedBy =
          requirement?.files?.find((file) => file.uploaded_by)?.uploaded_by ||
          requirement?.uploaded_by ||
          local?.uploadedBy ||
          null;
        return {
          key: document.id || `settings-${key}`,
          kind: document.documentKind === "license" ? "license" : "certificate",
          title: document.name,
          requiredDocumentId: document.id || null,
          issuedDate:
            local?.issuedDate ?? requirement?.issued_date ?? credential?.issued_date ?? null,
          expiryDate:
            local?.expiryDate ?? requirement?.expiry_date ?? credential?.expiry_date ?? null,
          hasExpiration:
            local?.hasExpiration ??
            (document.hasExpiration ||
              Boolean(requirement?.expiry_date || credential?.expiry_date)),
          scope: local?.scope ?? requirement?.scope ?? credential?.scope ?? null,
          issuingOrganization:
            local?.issuingOrganization ??
            requirement?.issuing_organization ??
            credential?.issuing_organization ??
            null,
          validity:
            local?.validity ?? requirement?.validity ?? credential?.validity ?? null,
          documentUrl: fileUrl,
          filename,
          uploadedBy: fileUrl ? uploadedBy : null,
        } satisfies DisplayRow;
      });

    const knownNames = new Set(fromSettings.map((row) => nameKey(row.title)));

    const fromRequirementsOnly: DisplayRow[] = requirements
      .filter(
        (row) =>
          (row.document_kind === "license" || row.document_kind === "certificate") &&
          !knownNames.has(nameKey(row.title))
      )
      .map((row) => {
        const key = nameKey(row.title);
        const credential = credentialByName.get(key);
        const local = localMetaByName[key];
        const fileUrl =
          local?.documentUrl ||
          row.files?.find((file) => file.url)?.url ||
          row.url ||
          credential?.document_url ||
          null;
        const filename =
          local?.filename ||
          row.files?.find((file) => file.filename)?.filename ||
          (row.filename && row.filename !== "—" ? row.filename : null) ||
          credential?.original_file_name ||
          null;
        const uploadedBy =
          row.files?.find((file) => file.uploaded_by)?.uploaded_by ||
          row.uploaded_by ||
          local?.uploadedBy ||
          null;
        knownNames.add(key);
        return {
          key: row.id,
          kind: row.document_kind === "license" ? "license" : "certificate",
          title: row.title,
          requiredDocumentId: row.required_document_id ?? null,
          issuedDate: local?.issuedDate ?? row.issued_date ?? credential?.issued_date ?? null,
          expiryDate: local?.expiryDate ?? row.expiry_date ?? credential?.expiry_date ?? null,
          hasExpiration:
            local?.hasExpiration ??
            (row.has_expiration === true ||
              Boolean(row.expiry_date || credential?.expiry_date)),
          scope: local?.scope ?? row.scope ?? credential?.scope ?? null,
          issuingOrganization:
            local?.issuingOrganization ??
            row.issuing_organization ??
            credential?.issuing_organization ??
            null,
          validity: local?.validity ?? row.validity ?? credential?.validity ?? null,
          documentUrl: fileUrl,
          filename,
          uploadedBy: fileUrl ? uploadedBy : null,
        } satisfies DisplayRow;
      });

    const fromCredentialsOnly: DisplayRow[] = credentials
      .filter((row) => !knownNames.has(nameKey(row.license_name)))
      .map((row) => {
        const key = nameKey(row.license_name);
        const local = localMetaByName[key];
        const looksLikeLicense = /license/i.test(row.license_name);
        const documentUrl = local?.documentUrl || row.document_url || null;
        return {
          key: `credential-${row.id}`,
          kind: looksLikeLicense ? "license" : "certificate",
          title: row.license_name,
          requiredDocumentId: row.required_document_id,
          issuedDate: local?.issuedDate ?? row.issued_date,
          expiryDate: local?.expiryDate ?? row.expiry_date,
          hasExpiration:
            local?.hasExpiration ?? Boolean(local?.expiryDate || row.expiry_date),
          scope: local?.scope ?? row.scope,
          issuingOrganization: local?.issuingOrganization ?? row.issuing_organization,
          validity: local?.validity ?? row.validity,
          documentUrl,
          filename: local?.filename || row.original_file_name || null,
          uploadedBy: documentUrl ? local?.uploadedBy ?? null : null,
        } satisfies DisplayRow;
      });

    return [...fromSettings, ...fromRequirementsOnly, ...fromCredentialsOnly];
  }, [selectedProfession, requirements, credentials, localMetaByName]);

  const licenseRows = rows.filter((row) => row.kind === "license");
  const certificateRows = rows.filter((row) => row.kind === "certificate");

  async function saveProfessionDocuments(nextDocuments: SettingsDocument[]) {
    if (!professionId) {
      throw new Error("Choose a profession on the Documents tab before adding licenses.");
    }
    const response = await fetch("/api/admin/profession-documents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        professionId,
        workerId,
        documents: nextDocuments.map((document) => ({
          ...(document.id ? { id: document.id } : {}),
          name: document.name,
          documentKind: document.documentKind,
          isRequired: document.isRequired,
          hasExpiration: document.hasExpiration,
        })),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      documents?: SettingsDocument[];
    };
    if (!response.ok) throw new Error(payload.error || "Could not save documents");
    return payload.documents ?? nextDocuments;
  }

  async function uploadForDocument(
    documentId: string,
    title: string,
    values: LicenseCertFormValues
  ) {
    const fd = new FormData();
    fd.append("workerId", workerId);
    fd.append("documentTitle", title);
    fd.append("requiredDocumentId", documentId);
    fd.append("issuedDate", values.hasExpiration ? values.issuedDate : "");
    fd.append("expiryDate", values.hasExpiration ? values.expiryDate : "");
    fd.append("issuingOrganization", values.issuingOrganization || "");
    fd.append("scope", values.scope || "");
    fd.append("validity", values.validity || "");
    if (values.file) {
      fd.append("file", values.file);
    } else {
      fd.append("attachmentKind", "profession_meta");
    }
    const res = await fetch("/api/admin/worker-attachment-upload", {
      method: "POST",
      body: fd,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      // Meta-only save can 404 when no file exists yet; keep the row from settings.
      if (!values.file && res.status === 404) return;
      throw new Error(json.error || "Upload failed");
    }
  }

  function patchSettingsDocuments(nextDocuments: SettingsDocument[]) {
    if (!professionId) return;
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        professions: current.professions.map((profession) =>
          profession.id === professionId
            ? { ...profession, documents: nextDocuments }
            : profession
        ),
      };
    });
  }

  async function handleSubmit(values: LicenseCertFormValues) {
    if (!modalKind) return;
    if (!settings?.canManage) {
      setModalError("Only an administrator can add or edit these documents.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const currentDocs = selectedProfession?.documents ?? [];
      let documentId = editing?.requiredDocumentId ?? null;
      const previousNameKey = editing ? nameKey(editing.title) : null;
      let savedDocuments: SettingsDocument[] = currentDocs;

      if (editing && documentId) {
        const nextDocs = currentDocs.map((document) =>
          document.id === documentId
            ? {
                ...document,
                name: values.name,
                documentKind: modalKind,
                hasExpiration: values.hasExpiration,
              }
            : document
        );
        savedDocuments = await saveProfessionDocuments(nextDocs);
        patchSettingsDocuments(savedDocuments);
        await uploadForDocument(documentId, values.name, values);
      } else {
        savedDocuments = await saveProfessionDocuments([
          ...currentDocs,
          {
            id: "",
            name: values.name,
            documentKind: modalKind,
            isRequired: true,
            hasExpiration: values.hasExpiration,
          },
        ]);
        patchSettingsDocuments(savedDocuments);
        const match =
          savedDocuments.find((document) => nameKey(document.name) === nameKey(values.name)) ??
          null;
        documentId = match?.id ?? null;
        if (documentId) {
          await uploadForDocument(documentId, values.name, values);
        }
      }

      // Best-effort metadata save when a matching workflow credential target exists.
      if (
        documentId &&
        (values.issuingOrganization || values.scope || values.validity || values.file)
      ) {
        const credentialsCatalog = await fetch(
          `/api/admin/worker-credentials?workerId=${encodeURIComponent(workerId)}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const catalogPayload = (await credentialsCatalog.json().catch(() => ({}))) as {
          documents?: Array<{ id: string; name: string }>;
        };
        const workflowDoc = (catalogPayload.documents ?? []).find(
          (document) => nameKey(document.name) === nameKey(values.name)
        );
        if (workflowDoc) {
          const form = new FormData();
          form.append("workerId", workerId);
          form.append("requiredDocumentId", workflowDoc.id);
          if (values.issuingOrganization) {
            form.append("issuingOrganization", values.issuingOrganization);
          }
          if (values.scope) form.append("scope", values.scope);
          if (values.validity) form.append("validity", values.validity);
          if (values.issuedDate) form.append("issuedDate", values.issuedDate);
          if (values.expiryDate) form.append("expiryDate", values.expiryDate);
          if (values.file) form.append("file", values.file);
          await fetch("/api/admin/worker-credentials", { method: "POST", body: form });
        }
      }

      const nextKey = nameKey(values.name);
      const staffUploaderLabel = currentUserName?.trim()
        ? currentUserRoleLabel?.trim()
          ? `${currentUserName.trim()} (${currentUserRoleLabel.trim()})`
          : currentUserName.trim()
        : null;
      const optimisticMeta: LocalMeta = {
        issuedDate: values.hasExpiration ? values.issuedDate || null : null,
        expiryDate: values.hasExpiration ? values.expiryDate || null : null,
        hasExpiration: values.hasExpiration,
        scope: values.scope || null,
        issuingOrganization: values.issuingOrganization || null,
        validity: values.validity || null,
        documentUrl: values.file
          ? URL.createObjectURL(values.file)
          : editing?.documentUrl ?? null,
        filename: values.file?.name ?? editing?.filename ?? null,
        uploadedBy: values.file
          ? staffUploaderLabel
          : editing?.uploadedBy ?? null,
      };
      setLocalMetaByName((current) => {
        const next = { ...current };
        if (previousNameKey && previousNameKey !== nextKey) {
          delete next[previousNameKey];
        }
        next[nextKey] = optimisticMeta;
        return next;
      });

      setModalKind(null);
      setEditing(null);
      await reloadAfterMutation(values.name);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(row: DisplayRow) {
    if (!settings?.canManage) {
      setError("Only an administrator can delete these documents.");
      return;
    }
    if (!row.requiredDocumentId || !selectedProfession) {
      setError("This item cannot be deleted from profession settings.");
      return;
    }
    setDeleteError(null);
    setPendingDelete(row);
  }

  async function confirmDelete() {
    if (!pendingDelete || !selectedProfession) return;
    if (!pendingDelete.requiredDocumentId) {
      setDeleteError("This item cannot be deleted from profession settings.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    setError(null);
    try {
      const remaining = await saveProfessionDocuments(
        selectedProfession.documents.filter(
          (document) => document.id !== pendingDelete.requiredDocumentId
        )
      );
      patchSettingsDocuments(remaining);
      setLocalMetaByName((current) => {
        const next = { ...current };
        delete next[nameKey(pendingDelete.title)];
        return next;
      });
      setPendingDelete(null);
      await reloadAfterMutation();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  function openAdd(kind: LicenseCertKind) {
    setEditing(null);
    setModalError(null);
    setModalKind(kind);
  }

  function openEdit(row: DisplayRow) {
    setEditing(row);
    setModalError(null);
    setModalKind(row.kind);
  }

  if (loading) {
    return <div className="mt-2 h-48 animate-pulse rounded-xl bg-[#F3F4F6]" />;
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <CredentialSection
        title="License"
        addLabel="Add License"
        columns="license"
        rows={licenseRows}
        onAdd={() => openAdd("license")}
        onEdit={openEdit}
        onDelete={requestDelete}
        canManage={Boolean(settings?.canManage)}
      />

      <CredentialSection
        title="Certifications"
        addLabel="Add Certification"
        columns="certificate"
        rows={certificateRows}
        onAdd={() => openAdd("certificate")}
        onEdit={openEdit}
        onDelete={requestDelete}
        canManage={Boolean(settings?.canManage)}
      />

      <AddLicenseCertModal
        open={modalKind != null}
        kind={modalKind ?? "license"}
        mode={editing ? "edit" : "add"}
        initial={
          editing
            ? {
                name: editing.title,
                hasExpiration: editing.hasExpiration || Boolean(editing.expiryDate),
                issuedDate: editing.issuedDate ?? "",
                expiryDate: editing.expiryDate ?? "",
                issuingOrganization: editing.issuingOrganization ?? "",
                scope: editing.scope ?? "",
                validity: editing.validity ?? "",
              }
            : null
        }
        existingFile={
          editing?.filename || editing?.documentUrl
            ? {
                name: editing.filename || "Uploaded document",
                url: editing.documentUrl,
              }
            : null
        }
        saving={saving}
        error={modalError}
        onClose={() => {
          if (saving) return;
          setModalKind(null);
          setEditing(null);
          setModalError(null);
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <BulkDeleteConfirmModal
        open={pendingDelete != null}
        busy={deleting}
        error={deleteError}
        title={
          pendingDelete?.kind === "certificate"
            ? "Delete certification?"
            : "Delete license?"
        }
        description={
          pendingDelete ? (
            <p>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-[#101828]">{pendingDelete.title}</span>? This
              action cannot be undone.
            </p>
          ) : null
        }
        onCancel={() => {
          if (deleting) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function CredentialSection({
  title,
  addLabel,
  columns,
  rows,
  onAdd,
  onEdit,
  onDelete,
  canManage,
}: {
  title: string;
  addLabel: string;
  columns: LicenseCertKind;
  rows: DisplayRow[];
  onAdd: () => void;
  onEdit: (row: DisplayRow) => void;
  onDelete: (row: DisplayRow) => void;
  canManage: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canManage}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--brand-primary)] bg-white px-3.5 text-sm font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  {columns === "certificate" ? "Certificate name" : "License name"}
                </th>
                {columns === "certificate" ? (
                  <>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Issuing organization
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Scope
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Validity
                    </th>
                  </>
                ) : null}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Issued date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Expiry date
                </th>
                {columns === "license" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Scope
                  </th>
                ) : null}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Uploaded by
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Download
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns === "certificate" ? 9 : 7}
                    className="px-4 py-8 text-center text-sm text-[#6B7280]"
                  >
                    No {title.toLowerCase()} yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="border-b border-[#F3F4F6] last:border-b-0">
                    <td className="px-4 py-3.5 text-sm font-medium text-[#111827]">
                      {row.title}
                    </td>
                    {columns === "certificate" ? (
                      <>
                        <td className="px-4 py-3.5 text-sm text-[#374151]">
                          {dash(row.issuingOrganization)}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-[#374151]">{dash(row.scope)}</td>
                        <td className="px-4 py-3.5 text-sm text-[#374151]">
                          {dash(row.validity)}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3.5 text-sm text-[#374151]">
                      {formatDisplayDate(row.issuedDate)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#374151]">
                      {row.hasExpiration || row.expiryDate
                        ? formatDisplayDate(row.expiryDate)
                        : "—"}
                    </td>
                    {columns === "license" ? (
                      <td className="px-4 py-3.5 text-sm text-[#374151]">{dash(row.scope)}</td>
                    ) : null}
                    <td className="px-4 py-3.5 text-sm text-[#374151]">
                      {dash(row.uploadedBy)}
                    </td>
                    <td className="px-4 py-3.5 text-sm">
                      {row.documentUrl ? (
                        <a
                          href={row.documentUrl}
                          download={row.filename || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--brand-primary)] underline-offset-2 transition hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Download
                        </a>
                      ) : (
                        <span className="text-[#9CA3AF]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => onDelete(row)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#64748B] disabled:opacity-40"
                          aria-label={`Delete ${row.title}`}
                        >
                          <BrandedDeleteIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => onEdit(row)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] disabled:opacity-40"
                          aria-label={`Edit ${row.title}`}
                        >
                          <BrandedEditIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
