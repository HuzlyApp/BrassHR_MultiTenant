"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { fetchStaffDetailJson, workerProfileApiUrl } from "@/lib/admin/staff-detail-fetch-cache";

type AttachmentRequirement = {
  id: string;
  title: string;
  url: string | null;
  filename: string;
  status?: string | null;
  phase?: "pre_hire" | "post_hire";
  step_type?: string;
  step_title?: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  files?: Array<{ id: string; url: string | null; filename: string; status: string | null }>;
};

type FilesPayload = {
  attachment_requirements?: AttachmentRequirement[];
  document_urls?: Record<string, string | null>;
  firma_signing?: {
    firma_status: string | null;
    updated_at: string | null;
  };
  documents?: {
    updated_at: string | null;
    nursing_license_url?: boolean;
    cpr_certification_url?: boolean;
    identity_uploaded?: boolean;
  } | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(label: string, tone: "green" | "gray" = "green") {
  const cls =
    tone === "green"
      ? "bg-[rgba(18,170,0,0.12)] text-[#12AA00]"
      : "bg-[#F3F4F6] text-[#6B7280]";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function signedStatusLabel(row: AttachmentRequirement, firmaStatus: string | null): string {
  const status = (row.status || "").toLowerCase();
  if (status.includes("signed") || firmaStatus === "completed" || firmaStatus === "signed") {
    const when = formatDate(row.issued_date);
    return when ? `Signed ${when}` : "Signed";
  }
  if (status.includes("complete") || status === "approved") return "Complete";
  if (row.url || (row.files && row.files.some((f) => f.url))) return "On file";
  if (status) return status.replace(/_/g, " ");
  return "Pending";
}

export function WorkerProfileFilesPanel({ workerId }: { workerId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FilesPayload | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { ok, payload } = await fetchStaffDetailJson<FilesPayload & { error?: string }>(
          workerProfileApiUrl(workerId)
        );
        if (!ok) throw new Error(payload.error || "Could not load files.");
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load files.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workerId]);

  const requirements = data?.attachment_requirements ?? [];

  const signedRows = useMemo(() => {
    return requirements.filter((row) => {
      const kind = `${row.step_type ?? ""} ${row.title ?? ""} ${row.step_title ?? ""}`.toLowerCase();
      return (
        !kind.includes("authorization") &&
        (row.phase !== "post_hire" || kind.includes("offer") || kind.includes("agreement") || kind.includes("handbook") || kind.includes("license") || kind.includes("handler") || kind.includes("credential"))
      );
    });
  }, [requirements]);

  const authRows = useMemo(() => {
    const fromReqs = requirements.filter((row) => {
      const kind = `${row.step_type ?? ""} ${row.title ?? ""} ${row.step_title ?? ""}`.toLowerCase();
      return kind.includes("authorization") || kind.includes("authorisation");
    });
    if (fromReqs.length > 0) return fromReqs;

    const authUrl = data?.document_urls?.authorization_document_url ?? null;
    if (authUrl) {
      return [
        {
          id: "authorization",
          title: "Authorization_agreement.pdf",
          filename: "Authorization_agreement.pdf",
          url: authUrl,
          status: "verified",
          issued_date: data?.documents?.updated_at ?? null,
          expiry_date: null,
        } satisfies AttachmentRequirement,
      ];
    }
    return [];
  }, [requirements, data?.document_urls, data?.documents?.updated_at]);

  const displaySigned =
    signedRows.length > 0
      ? signedRows
      : [
          ...(data?.firma_signing
            ? [
                {
                  id: "offer-agreement",
                  title: "Offer + Agreement",
                  filename: "Offer + Agreement",
                  url: null,
                  status: data.firma_signing.firma_status || "pending",
                  issued_date: data.firma_signing.updated_at,
                } satisfies AttachmentRequirement,
              ]
            : []),
          ...(data?.documents?.nursing_license_url
            ? [
                {
                  id: "license-card",
                  title: "License / Credential",
                  filename: "License",
                  url: data.document_urls?.nursing_license_url ?? null,
                  status: "on_file",
                } satisfies AttachmentRequirement,
              ]
            : []),
        ];

  if (loading) {
    return <div className="mt-5 h-48 animate-pulse rounded-xl bg-[#F3F4F6]" />;
  }

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#111827]">Signed files and credentials</h2>
        </div>
        <ul className="divide-y divide-[#F3F4F6]">
          {displaySigned.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[#6B7280]">No signed files yet.</li>
          ) : (
            displaySigned.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">
                    {row.title || row.filename}
                  </p>
                </div>
                {statusBadge(
                  signedStatusLabel(row, data?.firma_signing?.firma_status ?? null),
                  "green"
                )}
              </li>
            ))
          )}
        </ul>
        <p className="border-t border-[#F3F4F6] px-4 py-2.5 text-[11px] text-[#9CA3AF]">
          No view-pings. Events are the audit log.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#111827]">Authorization</h2>
          <a
            href={`/admin_recruiter/new/attachments/${encodeURIComponent(workerId)}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
          >
            <Plus className="size-3.5" aria-hidden />
            Add
          </a>
        </div>
        <ul className="divide-y divide-[#F3F4F6]">
          {authRows.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[#6B7280]">No authorization documents yet.</li>
          ) : (
            authRows.map((row) => {
              const verified = formatDate(row.issued_date) || formatDate(data?.documents?.updated_at);
              const expires = formatDate(row.expiry_date);
              const fileName = row.filename || row.title || "Authorization.pdf";
              const openUrl = row.url || row.files?.find((f) => f.url)?.url || null;
              return (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3.5">
                  <BrandedFileTypeIcon type="pdf" className="mt-0.5 size-8 shrink-0" />
                  <div className="min-w-0">
                    {openUrl ? (
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-semibold text-[#111827] hover:underline"
                      >
                        {fileName}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-semibold text-[#111827]">{fileName}</p>
                    )}
                    <p className="mt-0.5 text-xs text-[#6B7280]">
                      {verified ? `Verified: ${verified}` : "Not verified"}
                      {expires ? ` • Expires: ${expires}` : ""}
                    </p>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
