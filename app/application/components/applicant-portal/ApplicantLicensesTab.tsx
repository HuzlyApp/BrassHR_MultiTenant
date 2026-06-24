"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { WorkerPortalPageLoader } from "./WorkerPortalPageLoader";
import { LICENSE_TYPES, LICENSE_TYPE_LABELS } from "@/lib/applicant-portal/documents";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerFilePicker } from "./WorkerFilePicker";
import { WORKER_BTN_OUTLINE, WORKER_BTN_PRIMARY } from "./worker-portal-buttons";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type LicenseItem = {
  id: string;
  licenseType: string;
  licenseTypeLabel: string;
  licenseNumber: string | null;
  expiresAt: string | null;
  expiresAtLabel: string | null;
  status: string;
  statusLabel: string;
  urgency: "expired" | "expiring_soon" | "ok" | "unknown";
  reviewNotes: string | null;
  originalFileName: string | null;
  hasFile: boolean;
};

type LicenseSummary = {
  total: number;
  expiredCount: number;
  expiringSoonCount: number;
  pendingReviewCount: number;
};

function StatusBadge({ label, tone }: { label: string; tone: "red" | "amber" | "green" | "gray" }) {
  const styles = {
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-slate-50 text-slate-700 border-slate-200",
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>{label}</span>;
}

function statusTone(status: string, urgency: LicenseItem["urgency"]) {
  if (urgency === "expired" || status === "expired" || status === "rejected") return "red" as const;
  if (urgency === "expiring_soon" || status === "needs_revision") return "amber" as const;
  if (status === "approved") return "green" as const;
  return "gray" as const;
}

export function ApplicantLicensesTab({ embedded = false }: { embedded?: boolean }) {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [summary, setSummary] = useState<LicenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseType, setLicenseType] = useState<string>("nursing_license");
  const [expiresAt, setExpiresAt] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function loadLicenses() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/licenses", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as {
      licenses?: LicenseItem[];
      summary?: LicenseSummary;
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load licenses.");
    setLicenses(payload.licenses ?? []);
    setSummary(payload.summary ?? null);
  }

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    setLoading(true);

    void (async () => {
      try {
        await loadLicenses();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load licenses.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady]);

  async function openFile(id: string) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/applicant-portal/files?source=license&id=${encodeURIComponent(id)}`, {
      headers,
      cache: "no-store",
    });
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
      setError("Choose a license file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const form = new FormData();
      form.append("licenseType", licenseType);
      form.append("expiresAt", expiresAt);
      if (licenseNumber.trim()) form.append("licenseNumber", licenseNumber.trim());
      form.append("file", selectedFile);
      const res = await fetch("/api/applicant-portal/licenses", { method: "POST", headers, body: form });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not upload license.");
      setSelectedFile(null);
      setExpiresAt("");
      setLicenseNumber("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadLicenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload license.");
    } finally {
      setUploading(false);
    }
  }

  if (!sessionReady || loading) {
    return <WorkerPortalPageLoader label="Loading licenses..." />;
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 px-8 py-6"}>
      {summary && (summary.expiredCount > 0 || summary.expiringSoonCount > 0) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {summary.expiredCount > 0
                ? `${summary.expiredCount} license(s) expired. `
                : ""}
              {summary.expiringSoonCount > 0
                ? `${summary.expiringSoonCount} license(s) expiring within 30 days.`
                : ""}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Upload renewed license
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Submitted renewals go to your recruiter for review.
          </p>
        </div>
        <form onSubmit={handleUpload} className="space-y-4 p-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">License type</label>
              <select
                value={licenseType}
                onChange={(event) => setLicenseType(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              >
                {LICENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LICENSE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                Expiration date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">License number</label>
              <input
                value={licenseNumber}
                onChange={(event) => setLicenseNumber(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                License file <span className="text-red-500">*</span>
              </label>
              <WorkerFilePicker
                inputRef={fileInputRef}
                file={selectedFile}
                onChange={setSelectedFile}
                disabled={uploading}
              />
            </div>
          </div>
          <button type="submit" disabled={uploading} className={WORKER_BTN_PRIMARY}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Submit for review"}
          </button>
        </form>
      </div>

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Your licenses
          </h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {licenses.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#64748B]">No license records yet.</p>
          ) : (
            licenses.map((license) => (
              <div key={license.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{license.licenseTypeLabel}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Expires: {license.expiresAtLabel ?? "Not set"}
                    {license.licenseNumber ? ` · #${license.licenseNumber}` : ""}
                  </p>
                  {license.reviewNotes ? (
                    <p className="mt-2 text-xs text-[#B45309]">Reviewer note: {license.reviewNotes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={license.statusLabel} tone={statusTone(license.status, license.urgency)} />
                  {license.hasFile ? (
                    <button
                      type="button"
                      onClick={() => void openFile(license.id)}
                      className={WORKER_BTN_OUTLINE}
                    >
                      View file
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
