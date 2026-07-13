"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eye, Upload } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerFilePicker } from "./WorkerFilePicker";
import {
  WORKER_BTN_GHOST_ICON,
  WORKER_BTN_PRIMARY,
  WORKER_BTN_PRIMARY_SM,
} from "./worker-portal-buttons";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type DocumentItem = {
  id: string;
  source: "portal" | "required";
  title: string;
  documentType: string;
  originalFileName: string | null;
  status: string;
  statusLabel: string;
  reviewNotes: string | null;
  uploadedAt: string;
  requiredDocumentId?: string;
};

type MissingRequired = {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
};

type AgreementSection = {
  id: "w2" | "i9";
  title: string;
  kind: "esign" | "upload";
  hasFile: boolean;
  fileName: string;
  fileUrl: string | null;
  headerText: string;
  statusBadge: string | null;
  reviewStatus: string | null;
  reviewNotes: string | null;
  uploadRequested: boolean;
  requiredDocumentId: string | null;
  submittedDocumentId: string | null;
  statusLabel: string | null;
};

function ReviewStatusBadge({
  label,
  status,
}: {
  label: string;
  status: string | null;
}) {
  const tone =
    status === "approved"
      ? "border-transparent bg-[color:var(--brand-secondary)] text-white"
      : status === "rejected"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "needs_revision"
          ? "border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)]"
          : "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function AgreementDocumentFileCard({
  section,
}: {
  section: AgreementSection;
}) {
  if (!section.hasFile) {
    return (
      <div className="flex min-h-[50px] w-full max-w-[520px] items-center justify-between gap-3 rounded-[8px] border border-dashed border-[color:color-mix(in_srgb,var(--brand-primary)_30%,white)] bg-[#F8FAFC] px-3 py-2">
        <span className="text-xs text-[#6B7280]">No Document</span>
        {section.uploadRequested ? (
          <ReviewStatusBadge label="Upload needed" status="needs_revision" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-[50px] w-full max-w-[520px] items-center gap-2 rounded-[8px] border border-[color:color-mix(in_srgb,var(--brand-primary)_30%,white)] bg-[#F8FAFC] px-3 py-2">
      <BrandedFileTypeIcon type="pdf" className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold leading-4 text-[color:var(--brand-primary)]">
          {section.fileName}
        </div>
        {section.statusLabel ? (
          <div className="text-xs text-[#6B7280]">{section.statusLabel}</div>
        ) : null}
      </div>
      {section.statusBadge ? (
        <ReviewStatusBadge
          label={section.statusBadge}
          status={section.reviewStatus === "approved" ? "approved" : null}
        />
      ) : section.statusLabel ? (
        <ReviewStatusBadge label={section.statusLabel} status={section.reviewStatus} />
      ) : null}
    </div>
  );
}

function AgreementDocumentSection({
  section,
  index,
  uploading,
  onUpload,
  onView,
}: {
  section: AgreementSection;
  index: number;
  uploading: boolean;
  onUpload: (file: File) => void;
  onView: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canUpload = section.uploadRequested || (section.reviewStatus === "rejected" && section.hasFile);
  const canView = Boolean(section.hasFile && section.fileUrl);

  return (
    <section className="rounded-md border border-[#D1D5DB]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-[#111827]">
          {index + 1}. {section.title}
        </h3>
        <span className="text-sm text-[#6B7280]">{section.headerText}</span>
      </div>

      {section.reviewNotes && section.uploadRequested ? (
        <div className="border-b border-[#E5E7EB] bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {section.reviewNotes}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <AgreementDocumentFileCard section={section} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canView}
            onClick={onView}
            className={WORKER_BTN_GHOST_ICON}
            aria-label={`View ${section.title}`}
          >
            <Eye className="h-5 w-5" />
          </button>

          {canUpload ? (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className={WORKER_BTN_PRIMARY_SM}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : section.hasFile ? "Upload again" : "Upload file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  onUpload(file);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type UploadFieldErrors = {
  title?: string;
  file?: string;
};

function mapUploadError(message: string): { fieldErrors?: UploadFieldErrors; formError?: string } {
  const lower = message.toLowerCase();
  if (lower.includes("title")) return { fieldErrors: { title: message } };
  if (lower.includes("file")) return { fieldErrors: { file: message } };
  return { formError: message };
}

function OtherDocumentStatusBadge({ label, status }: { label: string; status: string }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "rejected" || status === "needs_revision"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function ApplicantDocumentsTab({ embedded = false }: { embedded?: boolean }) {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [portalDocuments, setPortalDocuments] = useState<DocumentItem[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<DocumentItem[]>([]);
  const [missingRequired, setMissingRequired] = useState<MissingRequired[]>([]);
  const [agreementSections, setAgreementSections] = useState<AgreementSection[]>([]);
  const [agreementUploadSection, setAgreementUploadSection] = useState<"w2" | "i9" | "">("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [uploadFieldErrors, setUploadFieldErrors] = useState<UploadFieldErrors>({});
  const [uploadFormError, setUploadFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [requiredDocumentId, setRequiredDocumentId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadDocuments() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/documents", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as {
      portalDocuments?: DocumentItem[];
      requiredDocuments?: DocumentItem[];
      missingRequired?: MissingRequired[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load documents.");
    setPortalDocuments(payload.portalDocuments ?? []);
    setRequiredDocuments(payload.requiredDocuments ?? []);
    setMissingRequired(payload.missingRequired ?? []);
  }

  async function loadAgreementSections() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/agreement", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as {
      sections?: AgreementSection[];
      error?: string;
    };
    if (!res.ok) return;
    setAgreementSections(payload.sections ?? []);
  }

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    setLoading(true);

    void (async () => {
      try {
        await Promise.all([loadDocuments(), loadAgreementSections()]);
      } catch (err) {
        if (alive) setPageError(err instanceof Error ? err.message : "Could not load documents.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady]);

  async function openFile(item: DocumentItem) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/applicant-portal/files?source=${encodeURIComponent(item.source)}&id=${encodeURIComponent(item.id)}`,
      { headers, cache: "no-store" }
    );
    const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !payload.url) {
      setDocumentsError(payload.error || "Could not open file.");
      return;
    }
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function handleAgreementUpload(section: AgreementSection, file: File) {
    setUploading(true);
    setAgreementUploadSection(section.id);
    setDocumentsError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const form = new FormData();
      form.append("file", file);
      form.append("section", section.id);
      if (section.requiredDocumentId) {
        form.append("requiredDocumentId", section.requiredDocumentId);
      }
      const res = await fetch("/api/applicant-portal/agreement/upload", {
        method: "POST",
        headers,
        body: form,
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not upload document.");
      await Promise.all([loadDocuments(), loadAgreementSections()]);
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : "Could not upload document.");
    } finally {
      setUploading(false);
      setAgreementUploadSection("");
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();

    const nextFieldErrors: UploadFieldErrors = {};
    if (!selectedFile) nextFieldErrors.file = "Choose a file to upload.";
    if (!requiredDocumentId && !title.trim()) {
      nextFieldErrors.title = "Document title is required.";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setUploadFieldErrors(nextFieldErrors);
      setUploadFormError(null);
      return;
    }

    const fileToUpload = selectedFile;
    if (!fileToUpload) return;

    setUploading(true);
    setUploadFieldErrors({});
    setUploadFormError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const form = new FormData();
      if (requiredDocumentId) {
        form.append("requiredDocumentId", requiredDocumentId);
      } else {
        form.append("title", title.trim());
        form.append("documentType", documentType);
      }
      form.append("file", fileToUpload);
      const res = await fetch("/api/applicant-portal/documents", { method: "POST", headers, body: form });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not upload document.");
      setSelectedFile(null);
      setTitle("");
      setRequiredDocumentId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload document.";
      const mapped = mapUploadError(message);
      if (mapped.fieldErrors) setUploadFieldErrors(mapped.fieldErrors);
      else setUploadFormError(mapped.formError ?? message);
    } finally {
      setUploading(false);
    }
  }

  const teamDocuments = agreementSections.filter(
    (section) => section.hasFile || section.uploadRequested
  );

  const otherDocuments = [...requiredDocuments, ...portalDocuments]
    .filter((doc) => {
      const title = doc.title.toLowerCase();
      return !title.includes("i9") && !title.includes("i-9") && !title.includes("w2") && !title.includes("employee agreement");
    })
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return (
    <div className={embedded ? "space-y-6" : `${WORKER_PORTAL_PAGE_PAD_CLASS} space-y-6`}>
      {pageError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>
      ) : null}

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Documents
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Files your team asks for. Upload when you see a request.
          </p>
        </div>

        <div className="space-y-4 p-4">
          {documentsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {documentsError}
            </div>
          ) : null}

          {teamDocuments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">
              No team document requests right now.
            </p>
          ) : (
            teamDocuments.map((section, index) => (
              <AgreementDocumentSection
                key={section.id}
                section={section}
                index={index}
                uploading={uploading && agreementUploadSection === section.id}
                onUpload={(file) => void handleAgreementUpload(section, file)}
                onView={() => {
                  if (!section.fileUrl) return;
                  window.open(section.fileUrl, "_blank", "noopener,noreferrer");
                }}
              />
            ))
          )}
        </div>
      </div>

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Add another file
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">Optional documents for your recruiter.</p>
        </div>
        <form onSubmit={handleUpload} className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Document type</label>
              <select
                value={requiredDocumentId}
                onChange={(event) => setRequiredDocumentId(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              >
                <option value="">Other document</option>
                {missingRequired.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Document name</label>
              <input
                value={
                  requiredDocumentId
                    ? missingRequired.find((item) => item.id === requiredDocumentId)?.title ?? title
                    : title
                }
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (uploadFieldErrors.title) {
                    setUploadFieldErrors((current) => ({ ...current, title: undefined }));
                  }
                }}
                disabled={Boolean(requiredDocumentId)}
                className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-[color:var(--brand-primary)] disabled:bg-[#F9FAFB] disabled:text-[#6B7280] ${
                  uploadFieldErrors.title ? "border-red-300" : "border-[#D1D5DB]"
                }`}
                placeholder="e.g. Immunization record"
              />
              {uploadFieldErrors.title ? (
                <p className="mt-1 text-xs text-red-600">{uploadFieldErrors.title}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Type</label>
              <input
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                disabled={Boolean(requiredDocumentId)}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)] disabled:bg-[#F9FAFB] disabled:text-[#6B7280]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">File</label>
              <WorkerFilePicker
                inputRef={fileInputRef}
                file={selectedFile}
                onChange={(file) => {
                  setSelectedFile(file);
                  if (uploadFieldErrors.file) {
                    setUploadFieldErrors((current) => ({ ...current, file: undefined }));
                  }
                }}
                disabled={uploading}
                error={uploadFieldErrors.file}
              />
            </div>
          </div>

          {uploadFormError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {uploadFormError}
            </div>
          ) : null}
          <button type="submit" disabled={uploading} className={WORKER_BTN_PRIMARY}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>

      {otherDocuments.length > 0 ? (
        <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
              Your other files
            </h2>
          </div>
          <div className="divide-y divide-[#E5E7EB]">
            {otherDocuments.map((doc) => (
              <div
                key={`${doc.source}-${doc.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <BrandedFileTypeIcon type="pdf" className="h-6 w-6 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--brand-primary)]">
                      {doc.originalFileName || doc.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {doc.title} · {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                    {doc.reviewNotes ? (
                      <p className="mt-1 text-xs text-amber-800">{doc.reviewNotes}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <OtherDocumentStatusBadge
                    label={doc.statusLabel || documentStatusLabel(doc.status)}
                    status={doc.status}
                  />
                  <button
                    type="button"
                    onClick={() => void openFile(doc)}
                    className={WORKER_BTN_GHOST_ICON}
                    aria-label="View file"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
