"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eye, Upload } from "lucide-react";
import { WorkerPortalPageLoader } from "./WorkerPortalPageLoader";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import {
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--brand-primary)] disabled:opacity-40"
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
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-primary)] px-4 text-xs font-semibold text-white disabled:opacity-50"
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
  const [error, setError] = useState<string | null>(null);
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
        if (alive) setError(err instanceof Error ? err.message : "Could not load documents.");
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
      setError(payload.error || "Could not open file.");
      return;
    }
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  async function handleAgreementUpload(section: AgreementSection, file: File) {
    setUploading(true);
    setAgreementUploadSection(section.id);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Could not upload document.");
    } finally {
      setUploading(false);
      setAgreementUploadSection("");
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
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
      form.append("file", selectedFile);
      const res = await fetch("/api/applicant-portal/documents", { method: "POST", headers, body: form });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not upload document.");
      setSelectedFile(null);
      setTitle("");
      setRequiredDocumentId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload document.");
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

  if (!sessionReady || loading) {
    return <WorkerPortalPageLoader label="Loading documents..." />;
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 px-8 py-6"}>
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
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
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
          {missingRequired.length > 0 ? (
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
          ) : null}
          {!requiredDocumentId ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Name</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
                  placeholder="e.g. Immunization record"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Type</label>
                <input
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
                />
              </div>
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-md file:border-0 file:bg-[#F1F5F9] file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
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
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[color:var(--brand-primary)] hover:bg-[#F8FAFC]"
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
