"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ChevronDown, ExternalLink, Save, Send, Upload } from "lucide-react";
import FirmaTemplateBuilderFrame from "@/app/admin_recruiter/components/FirmaTemplateBuilderFrame";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import { NAVY, statusBadgeClass } from "@/app/admin_recruiter/components/RecruiterTemplateCards";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  RECRUITER_TEMPLATE_CATEGORIES,
  RECRUITER_TEMPLATE_CATEGORY_LABELS,
} from "@/lib/recruiter-templates/constants";
import {
  assignTemplateToFolder,
  findFolderForTemplate,
  readTemplateFolders,
  resolveFolderStorageScope,
  type RecruiterTemplateFolder,
} from "@/lib/recruiter-templates/template-folders-storage";
import type {
  RecruiterTemplateDetail,
  RecruiterTemplateRoleInput,
} from "@/lib/recruiter-templates/types";

type BuilderProps = {
  templateId?: string;
  initialPreview?: boolean;
};

type DetailResponse = {
  template?: RecruiterTemplateDetail;
  error?: string;
  code?: string;
  details?: { issues?: string[] };
};

const DEFAULT_ROLES: RecruiterTemplateRoleInput[] = [
  { role_key: "candidate", label: "Candidate", designation: "Signer", signing_order: 1 },
  { role_key: "recruiter", label: "Recruiter", designation: "Signer", signing_order: 2 },
  { role_key: "hiring_manager", label: "Hiring Manager", designation: "Signer", signing_order: 3 },
  { role_key: "hr_admin", label: "HR / Admin", designation: "Signer", signing_order: 4 },
];

const inputClassName =
  "w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]";

const fieldClassName = `mt-1 ${inputClassName}`;

const selectClassName = `${inputClassName} cursor-pointer appearance-none pr-10`;

function buildPayload(
  name: string,
  description: string,
  category: string,
  expirationHours: number,
  documentFileName: string | null,
  documentStoragePath: string | null
) {
  return {
    name,
    description: description.trim() || null,
    category,
    expiration_hours: expirationHours,
    roles: DEFAULT_ROLES,
    fields: [],
    document_file_name: documentFileName,
    document_storage_path: documentStoragePath,
  };
}

export default function RecruiterTemplateBuilderForm({
  templateId,
  initialPreview = false,
}: BuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useTenantBranding();
  const primary = branding.primaryHex || NAVY;
  const folderScope = resolveFolderStorageScope(branding.id, branding.slug);
  const isNew = !templateId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(initialPreview);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(RECRUITER_TEMPLATE_CATEGORIES[0]);
  const [expirationHours, setExpirationHours] = useState(168);
  const [status, setStatus] = useState<string>("draft");
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const [documentStoragePath, setDocumentStoragePath] = useState<string | null>(null);
  const [firmaTemplateId, setFirmaTemplateId] = useState<string | null>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(templateId);
  const [firmaDocumentUrl, setFirmaDocumentUrl] = useState<string | null>(null);
  const [folders, setFolders] = useState<RecruiterTemplateFolder[]>([]);
  const [folderId, setFolderId] = useState<string>("");

  useEffect(() => {
    const list = readTemplateFolders(folderScope);
    setFolders(list);
    const fromQuery = searchParams.get("folder")?.trim() ?? "";
    if (isNew && fromQuery && list.some((f) => f.id === fromQuery)) {
      setFolderId(fromQuery);
    }
  }, [folderScope, isNew, searchParams]);

  const applyTemplate = useCallback(
    (template: RecruiterTemplateDetail) => {
      setName(template.name);
      setDescription(template.description ?? "");
      setCategory(template.category);
      setExpirationHours(template.expiration_hours);
      setStatus(template.status);
      setDocumentFileName(template.document_file_name);
      setDocumentStoragePath(template.document_storage_path);
      setFirmaTemplateId(template.firma_template_id);
      const list = readTemplateFolders(folderScope);
      setFolders(list);
      const existing = findFolderForTemplate(list, template.id);
      setFolderId(existing?.id ?? "");
    },
    [folderScope]
  );

  const handleTemplateSynced = useCallback(
    (template: RecruiterTemplateDetail) => {
      applyTemplate(template);
      setFirmaDocumentUrl(null);
    },
    [applyTemplate]
  );

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates/${templateId}`);
      const payload = (await res.json()) as DetailResponse;
      if (!res.ok || !payload.template) {
        throw new Error(payload.error ?? "Failed to load template");
      }
      applyTemplate(payload.template);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [applyTemplate, templateId]);

  useEffect(() => {
    if (templateId) void loadTemplate();
  }, [loadTemplate, templateId]);

  const backHref = useMemo(() => {
    if (folderId) return `/admin_recruiter/template-builder/folder/${folderId}`;
    return "/admin_recruiter/template-builder";
  }, [folderId]);

  const persistFolderAssignment = (savedTemplateId: string) => {
    assignTemplateToFolder(folderScope, savedTemplateId, folderId || null);
    setFolders(readTemplateFolders(folderScope));
  };

  const saveDraft = async (options?: {
    redirectToListing?: boolean;
  }): Promise<RecruiterTemplateDetail | null> => {
    if (!name.trim()) {
      setSaveError("Template name is required.");
      return null;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const payload = buildPayload(
        name,
        description,
        category,
        expirationHours,
        documentFileName,
        documentStoragePath
      );
      const endpoint =
        isNew || !currentTemplateId
          ? "/api/admin/recruiter-templates"
          : `/api/admin/recruiter-templates/${currentTemplateId}`;

      const res = await recruiterTemplateFetch(endpoint, {
        method: isNew || !currentTemplateId ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json()) as DetailResponse;
      if (!res.ok || !body.template) {
        const issues = body.details?.issues?.join(", ");
        throw new Error(issues ?? body.error ?? "Save failed");
      }

      applyTemplate(body.template);
      setCurrentTemplateId(body.template.id);
      persistFolderAssignment(body.template.id);
      toast.success("Template saved");
      if (options?.redirectToListing) {
        router.push(backHref);
      } else if (isNew) {
        const qs = folderId ? `?folder=${encodeURIComponent(folderId)}` : "";
        router.replace(`/admin_recruiter/template-builder/${body.template.id}${qs}`);
      }
      return body.template;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      toast.error(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openBuilder = async () => {
    const saved = await saveDraft();
    const id = saved?.id ?? currentTemplateId;
    if (!id) return;
    if (!saved?.document_storage_path && !documentStoragePath && !saved?.firma_template_id) {
      toast.error("Upload a PDF or DOCX before opening the signature template builder");
      return;
    }
    setCurrentTemplateId(id);
    setBuilderOpen(true);
  };

  useEffect(() => {
    if (!builderOpen || !currentTemplateId) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector("[data-firma-builder-frame]")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [builderOpen, currentTemplateId]);

  const publishTemplate = async () => {
    const id = currentTemplateId;
    if (!id) {
      toast.error("Save the template before publishing");
      return;
    }

    setPublishing(true);
    try {
      const saved = await saveDraft();
      if (!saved) return;

      const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates/${id}/publish`, {
        method: "POST",
      });
      const body = (await res.json()) as DetailResponse;
      if (!res.ok || !body.template) {
        const issues = body.details?.issues?.join(", ");
        throw new Error(issues ?? body.error ?? "Publish failed");
      }
      applyTemplate(body.template);
      persistFolderAssignment(body.template.id);
      toast.success("Template marked active");
      router.push(backHref);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const uploadDocument = async (file: File) => {
    let id = currentTemplateId;
    if (!id) {
      const saved = await saveDraft();
      id = saved?.id;
    }
    if (!id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates/${id}/document`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setDocumentFileName(body.document_file_name ?? file.name);
      setDocumentStoragePath(body.document_storage_path ?? null);
      setBuilderOpen(false);
      toast.success("Document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#EAECF0] bg-white p-10 text-center text-sm text-[#667085]">
        Loading template...
      </div>
    );
  }

  const title =
    isNew && !currentTemplateId ? "New recruiting template" : name || "Template builder";

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-7 text-[#101828] min-[700px]:text-xl">
            {title}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-[#667085] min-[700px]:text-sm">
            Secure e-signature field placement and role assignment for recruiting documents.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap gap-2 min-[480px]:w-auto min-[480px]:justify-end">
          <button
            type="button"
            disabled={publishing || status === "archived"}
            onClick={() => void publishTemplate()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 min-[480px]:flex-none"
            style={{ backgroundColor: primary }}
          >
            <Send className="h-4 w-4" />
            Publish
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] px-4 text-sm font-medium text-[#344054] disabled:opacity-50 min-[480px]:flex-none"
          >
            <Save className="h-4 w-4" />
            Save as draft
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-[#EAECF0] bg-white p-4 sm:p-5">
        {saveError ? <p role="alert" className="mb-3 text-sm text-red-700">{saveError}</p> : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:items-start">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block min-w-0">
                <span className="text-sm font-medium text-[#344054]">Template Name</span>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSaveError(null); }}
                  aria-invalid={Boolean(saveError && !name.trim())}
                  className={fieldClassName}
                  placeholder="Offer letter - full time"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-medium text-[#344054]">Workflow type</span>
                <div className="relative mt-1">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={selectClassName}
                  >
                    {RECRUITER_TEMPLATE_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {RECRUITER_TEMPLATE_CATEGORY_LABELS[item]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
                    aria-hidden
                  />
                </div>
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-medium text-[#344054]">Save templates to</span>
                <div className="relative mt-1">
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="">Uncategorized</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
                    aria-hidden
                  />
                </div>
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-medium text-[#344054]">Subject</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={fieldClassName}
                  placeholder="Short subject or description"
                />
              </label>
            </div>
          </div>

          <aside className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
            <h2 className="text-sm font-semibold text-[#101828]">Status</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#667085]">Status</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${statusBadgeClass(status)}`}
                  >
                    {status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#667085]">E-Signature</dt>
                <dd className="truncate font-medium text-[#101828]">{firmaTemplateId ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#667085]">Document</dt>
                <dd className="truncate font-medium text-[#101828]">{documentFileName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#667085]">Expiration</dt>
                <dd className="font-medium text-[#101828]">{expirationHours}h</dd>
              </div>
            </dl>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-[#667085]">Expiration hours</span>
              <input
                type="number"
                min={1}
                max={8760}
                value={expirationHours}
                onChange={(e) => setExpirationHours(Number(e.target.value))}
                className={`${fieldClassName} bg-white`}
              />
            </label>
            {firmaDocumentUrl ? (
              <a
                href={firmaDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--brand-primary)]"
              >
                <ExternalLink className="h-4 w-4" />
                Open document
              </a>
            ) : null}
          </aside>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#EAECF0] pt-5 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] min-[480px]:w-auto min-[480px]:justify-start">
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : documentFileName ? "Replace document" : "Upload PDF or DOCX"}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadDocument(file);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void openBuilder()}
            disabled={saving || uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 min-[480px]:w-auto"
            style={{ backgroundColor: "var(--brand-secondary, #BC8B41)" }}
          >
            <ExternalLink className="h-4 w-4" />
            Open signature template builder
          </button>
        </div>
      </section>

      {builderOpen && currentTemplateId ? (
        <FirmaTemplateBuilderFrame
          templateId={currentTemplateId}
          onTemplateSynced={handleTemplateSynced}
          onClose={() => setBuilderOpen(false)}
        />
      ) : null}
    </div>
  );
}
