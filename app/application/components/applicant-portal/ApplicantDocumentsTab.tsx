"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useApplicantPortalAuthHeaders } from "./useApplicantPortalSession";
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

function StatusBadge({ label, status }: { label: string; status: string }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "rejected" || status === "needs_revision"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

export function ApplicantDocumentsTab() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [portalDocuments, setPortalDocuments] = useState<DocumentItem[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<DocumentItem[]>([]);
  const [missingRequired, setMissingRequired] = useState<MissingRequired[]>([]);
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

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await loadDocuments();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load documents.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders]);

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

  const allDocuments = [...requiredDocuments, ...portalDocuments].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  if (loading) {
    return <p className="px-8 py-10 text-sm text-[#64748B]">Loading documents...</p>;
  }

  return (
    <div className="space-y-6 px-8 py-6">
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Upload document
          </h2>
        </div>
        <form onSubmit={handleUpload} className="space-y-4 p-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
          {missingRequired.length > 0 ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Required document</label>
              <select
                value={requiredDocumentId}
                onChange={(event) => setRequiredDocumentId(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              >
                <option value="">Upload optional document instead</option>
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
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Document title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
                  placeholder="e.g. Immunization record"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Document type</label>
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
            {uploading ? "Uploading..." : "Upload document"}
          </button>
        </form>
      </div>

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Your documents
          </h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {allDocuments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#64748B]">No uploaded documents yet.</p>
          ) : (
            allDocuments.map((doc) => (
              <div key={`${doc.source}-${doc.id}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{doc.title}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {doc.source === "required" ? "Required" : doc.documentType} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                  {doc.originalFileName ? (
                    <p className="mt-1 text-xs text-[#94A3B8]">{doc.originalFileName}</p>
                  ) : null}
                  {doc.reviewNotes ? (
                    <p className="mt-2 text-xs text-[#B45309]">Reviewer note: {doc.reviewNotes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={doc.statusLabel} status={doc.status} />
                  <button
                    type="button"
                    onClick={() => void openFile(doc)}
                    className="rounded-md border border-[#D1D5DB] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
                  >
                    View file
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
