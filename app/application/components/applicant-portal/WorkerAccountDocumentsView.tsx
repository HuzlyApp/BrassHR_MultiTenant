"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import { WORKER_BTN_GHOST_ICON } from "./worker-portal-buttons";

type DocumentItem = {
  id: string;
  source: "portal" | "required";
  title: string;
  documentType: string;
  originalFileName: string | null;
  statusLabel: string;
  reviewNotes: string | null;
  uploadedAt: string;
};

type WorkerAccountDocumentsViewProps = {
  workerId: string;
};

function formatUploadedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function WorkerAccountDocumentsView({ workerId }: WorkerAccountDocumentsViewProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [missingRequired, setMissingRequired] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/worker-account-documents?workerId=${encodeURIComponent(workerId)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json().catch(() => ({}))) as {
          documents?: DocumentItem[];
          missingRequired?: Array<{ id: string; title: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load documents.");
        if (!alive) return;
        setDocuments(payload.documents ?? []);
        setMissingRequired(payload.missingRequired ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load documents.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [workerId]);

  async function handleDownload(source: "portal" | "required", id: string) {
    const res = await fetch(
      `/api/admin/worker-account-files?workerId=${encodeURIComponent(workerId)}&source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`
    );
    const payload = (await res.json().catch(() => ({}))) as { url?: string };
    if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <section className={WORKER_SCHEDULE_CARD_CLASS}>
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading documents...
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Documents
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">Files uploaded by this worker.</p>
        </div>

        {documents.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#6B7280]">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {documents.map((doc) => (
              <li
                key={`${doc.source}-${doc.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <BrandedFileTypeIcon type="pdf" className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">
                      {doc.originalFileName || doc.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6B7280]">
                      {doc.title} · {formatUploadedDate(doc.uploadedAt)}
                    </p>
                    {doc.reviewNotes ? (
                      <p className="mt-1 text-xs text-amber-800">{doc.reviewNotes}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-[#475569]">
                    {doc.statusLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc.source, doc.id)}
                    className={`${WORKER_BTN_GHOST_ICON} border border-[#E5E7EB]`}
                    aria-label={`Download ${doc.title}`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {missingRequired.length > 0 ? (
        <section className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3">
            <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
              Missing required
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">Documents still needed from this worker.</p>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {missingRequired.map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm text-[#374151]">
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
