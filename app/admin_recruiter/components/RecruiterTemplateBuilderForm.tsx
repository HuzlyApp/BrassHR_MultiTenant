"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ChevronDown, ExternalLink, Save, Send, Upload } from "lucide-react";
import FirmaTemplateBuilderFrame from "@/app/admin_recruiter/components/FirmaTemplateBuilderFrame";
import { recruiterTemplateFetch } from "@/app/admin_recruiter/components/recruiter-template-auth";
import { prepareFirmaPdfWorker } from "@/lib/firma/pdf-worker-patch";
import {
  RECRUITER_TEMPLATE_CATEGORIES,
  RECRUITER_TEMPLATE_CATEGORY_LABELS,
} from "@/lib/recruiter-templates/constants";
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
  const isNew = !templateId;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
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

  const applyTemplate = useCallback((template: RecruiterTemplateDetail) => {
    setName(template.name);
    setDescription(template.description ?? "");
    setCategory(template.category);
    setExpirationHours(template.expiration_hours);
    setStatus(template.status);
    setDocumentFileName(template.document_file_name);
    setDocumentStoragePath(template.document_storage_path);
    setFirmaTemplateId(template.firma_template_id);
  }, []);

  const handleTemplateSynced = useCallback((template: RecruiterTemplateDetail) => {
    applyTemplate(template);
    setFirmaDocumentUrl(null);
  }, [applyTemplate]);

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

  const saveDraft = async (): Promise<RecruiterTemplateDetail | null> => {
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
      toast.success("Template saved");
      if (isNew) {
        router.replace(`/admin_recruiter/template-builder/${body.template.id}`);
      }
      return body.template;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openBuilder = async () => {
    void prepareFirmaPdfWorker();
    const saved = await saveDraft();
    const id = saved?.id ?? currentTemplateId;
    if (!id) return;
    if (!saved?.document_storage_path && !documentStoragePath && !saved?.firma_template_id) {
      toast.error("Upload a PDF or DOCX before opening Firma builder");
      return;
    }
    setCurrentTemplateId(id);
    setBuilderOpen(true);
  };

  const publishTemplate = async () => {
    const id = currentTemplateId;
    if (!id) {
      toast.error("Save the template before publishing");
      return;
    }

    setPublishing(true);
    try {
      await saveDraft();
      const res = await recruiterTemplateFetch(`/api/admin/recruiter-templates/${id}/publish`, {
        method: "POST",
      });
      const body = (await res.json()) as DetailResponse;
      if (!res.ok || !body.template) {
        const issues = body.details?.issues?.join(", ");
        throw new Error(issues ?? body.error ?? "Publish failed");
      }
      applyTemplate(body.template);
      toast.success("Template marked active");
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
      <div className="border border-[#EAECF0] bg-white p-10 text-center text-sm text-[#667085]">
        Loading template...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-start min-[480px]:justify-between lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/admin_recruiter/template-builder"
            className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#667085] hover:bg-[#F9FAFB]"
            aria-label="Back to templates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-7 text-[#101828] min-[700px]:text-xl">
              {isNew && !currentTemplateId ? "New recruiting template" : name || "Template builder"}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-[#667085] min-[700px]:text-sm">
              Firma.dev powers document field placement and role assignment.
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-wrap gap-2 min-[480px]:w-auto min-[480px]:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] px-4 text-sm font-medium text-[#344054] disabled:opacity-50 min-[480px]:flex-none"
          >
            <Save className="h-4 w-4" />
            Save draft
          </button>
          <button
            type="button"
            disabled={publishing || status === "archived"}
            onClick={() => void publishTemplate()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50 min-[480px]:flex-none"
          >
            <Send className="h-4 w-4" />
            Publish
          </button>
        </div>
      </div>

      <section className="border border-[#EAECF0] bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:items-start">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block min-w-0">
                <span className="text-sm font-medium text-[#344054]">Template name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                <span className="text-sm font-medium text-[#344054]">Expiration hours</span>
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(Number(e.target.value))}
                  className={fieldClassName}
                />
              </label>
            </div>
            <label className="block min-w-0">
              <span className="text-sm font-medium text-[#344054]">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={fieldClassName}
              />
            </label>
          </div>

          <aside className="border border-[#EAECF0] p-4">
            <h2 className="text-sm font-semibold text-[#101828]">Status</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Status</dt>
                <dd className="font-medium capitalize text-[#101828]">{status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#667085]">Firma</dt>
                <dd className="truncate font-medium text-[#101828]">{firmaTemplateId ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-[#667085]">Document</dt>
                <dd className="truncate font-medium text-[#101828]">{documentFileName ?? "-"}</dd>
              </div>
            </dl>
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--brand-secondary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 min-[480px]:w-auto"
          >
            <ExternalLink className="h-4 w-4" />
            Open Firma builder
          </button>
        </div>
      </section>

      {builderOpen && currentTemplateId ? (
        <FirmaTemplateBuilderFrame
          templateId={currentTemplateId}
          onTemplateSynced={handleTemplateSynced}
        />
      ) : null}
    </div>
  );
}
