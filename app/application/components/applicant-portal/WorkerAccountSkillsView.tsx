"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useWorkerAccountOverview } from "./WorkerAccountContext";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import { WORKER_BTN_OUTLINE } from "./worker-portal-buttons";

type LicenseItem = {
  id: string;
  licenseTypeLabel: string;
  licenseNumber: string | null;
  expiresAtLabel: string | null;
  statusLabel: string;
  urgency: "expired" | "expiring_soon" | "ok" | "unknown";
  reviewNotes: string | null;
  hasFile: boolean;
};

type WorkerAccountSkillsViewProps = {
  workerId: string;
};

function StatusBadge({ label, tone }: { label: string; tone: "red" | "amber" | "green" | "gray" }) {
  const styles = {
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-slate-50 text-slate-700 border-slate-200",
  }[tone];
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

function statusTone(urgency: LicenseItem["urgency"], statusLabel: string): "red" | "amber" | "green" | "gray" {
  if (urgency === "expired") return "red";
  if (urgency === "expiring_soon") return "amber";
  if (statusLabel.toLowerCase().includes("approved")) return "green";
  return "gray";
}

export function WorkerAccountSkillsView({ workerId }: WorkerAccountSkillsViewProps) {
  const overview = useWorkerAccountOverview();
  const skills = overview?.skills ?? [];
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/worker-account-licenses?workerId=${encodeURIComponent(workerId)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json().catch(() => ({}))) as {
          licenses?: LicenseItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load certifications.");
        if (!alive) return;
        setLicenses(payload.licenses ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load certifications.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [workerId]);

  async function openFile(id: string) {
    const res = await fetch(
      `/api/admin/worker-account-files?workerId=${encodeURIComponent(workerId)}&source=license&id=${encodeURIComponent(id)}`
    );
    const payload = (await res.json().catch(() => ({}))) as { url?: string };
    if (payload.url) window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className={WORKER_SCHEDULE_CARD_CLASS}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Skills
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">Roles and skills on file.</p>
        </div>
        <div className="p-4">
          {skills.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No skills added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Certifications
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">Licenses and certifications uploaded.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading...
          </div>
        ) : licenses.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#6B7280]">No certifications uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {licenses.map((license) => (
              <li
                key={license.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">{license.licenseTypeLabel}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Expires: {license.expiresAtLabel ?? "Not set"}
                    {license.licenseNumber ? ` · #${license.licenseNumber}` : ""}
                  </p>
                  {license.reviewNotes ? (
                    <p className="mt-2 text-xs text-[#B45309]">Note: {license.reviewNotes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={license.statusLabel}
                    tone={statusTone(license.urgency, license.statusLabel)}
                  />
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
