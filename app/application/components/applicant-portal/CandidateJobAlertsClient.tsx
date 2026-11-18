"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Briefcase, Plus, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { resolveApplicantPortalTenantSlug } from "@/lib/applicant-portal/client-tenant";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { CANDIDATE_BTN_NAVY, CANDIDATE_BTN_OUTLINE, CandidatePageIntro } from "./candidate-portal-ui";

type Alert = {
  id: string;
  name: string;
  keywords: string[];
  createdAt: string;
};

type PublicJob = {
  id?: string;
  public_job_token: string;
  public_title: string;
  source_job_title?: string | null;
  source_type?: string | null;
  location: string | null;
  published_at: string | null;
  updated_at?: string | null;
};

const COLORS = ["bg-[#DCFCE7] text-[#15803D]", "bg-[#FFEDD5] text-[#C2410C]", "bg-[#DBEAFE] text-[#1D4ED8]", "bg-[#EDE9FE] text-[#6D28D9]", "bg-[#E0F2FE] text-[#0369A1]"];

function storageKey(applicantId: string) {
  return `candidate-job-alerts:${applicantId}`;
}

function matchScore(job: PublicJob, alert: Alert): number {
  const haystack = `${publicJobDisplayTitle(job)} ${job.location ?? ""}`.toLowerCase();
  const terms = [alert.name, ...alert.keywords].map((term) => term.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return 0;
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return Math.round((hits / terms.length) * 100);
}

export function CandidateJobAlertsClient() {
  const { session } = useApplicantPortal();
  const branding = useTenantBranding();
  const searchParams = useSearchParams();
  const tenant = searchParams?.get("tenant");
  const applicantId = session?.applicant.id ?? "";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");

  useEffect(() => {
    if (!applicantId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey(applicantId)) || "[]") as Alert[];
      setAlerts(stored);
      setSelectedId(stored[0]?.id ?? null);
    } catch {
      setAlerts([]);
    }
  }, [applicantId]);

  useEffect(() => {
    const tenantSlug = branding.slug?.trim().toLowerCase() || resolveApplicantPortalTenantSlug() || "";
    if (!tenantSlug) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ tenant: tenantSlug, page: "1", pageSize: "50" });
    void fetch(`/api/public/jobs?${params}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as { jobs?: PublicJob[]; error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load jobs.");
        setJobs(payload.jobs ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load jobs."))
      .finally(() => setLoading(false));
  }, [branding.slug]);

  const selected = alerts.find((alert) => alert.id === selectedId) ?? alerts[0] ?? null;
  const matches = useMemo(() => {
    if (!selected) return [];
    return jobs
      .map((job) => ({ job, score: matchScore(job, selected) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [jobs, selected]);

  function saveAlerts(next: Alert[]) {
    setAlerts(next);
    if (applicantId) localStorage.setItem(storageKey(applicantId), JSON.stringify(next));
  }

  function createAlert() {
    const keywordList = keywords.split(",").map((item) => item.trim()).filter(Boolean);
    if (!name.trim()) return;
    const alert: Alert = {
      id: crypto.randomUUID(),
      name: name.trim(),
      keywords: keywordList,
      createdAt: new Date().toISOString(),
    };
    const next = [...alerts, alert];
    saveAlerts(next);
    setSelectedId(alert.id);
    setName("");
    setKeywords("");
    setCreateOpen(false);
  }

  return (
    <div className="w-full min-w-0 px-4 py-6 min-[1000px]:px-8">
      <CandidatePageIntro
        title="Job Alerts"
        subtitle="Get notified about new job opportunities that match your skills, preferences, and career interests."
        action={
          <button type="button" className={CANDIDATE_BTN_NAVY} onClick={() => setCreateOpen(true)}>
            Create New Alert
          </button>
        }
      />

      <section className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">My Alerts</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {alerts.map((alert) => {
            const active = selected?.id === alert.id;
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => setSelectedId(alert.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? "border-[#012352] bg-[#012352] text-white"
                    : "border-[#E5E7EB] bg-white text-[#374151]"
                }`}
              >
                {alert.name}
                <span className={active ? "text-white/80" : "text-[#94A3B8]"}>{alert.keywords.length}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#CBD5E1] px-3 py-1 text-xs text-[#374151]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3 w-3" /> New Alert
          </button>
        </div>
        {selected ? (
          <p className="mt-4 border-t border-[#F3F4F6] pt-3 text-xs text-[#6B7280]">
            Filters: {[selected.name, ...selected.keywords].join(" · ")} · Created on{" "}
            {new Date(selected.createdAt).toLocaleDateString("en-US", {
              timeZone: "America/New_York",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : (
          <p className="mt-4 text-xs text-[#6B7280]">Create an alert to match published jobs.</p>
        )}
      </section>

      {error ? <p className="mb-3 text-sm text-[#B91C1C]">{error}</p> : null}
      {loading ? <p className="text-sm text-[#6B7280]">Loading matches…</p> : null}

      <div className="space-y-3">
        {matches.map(({ job, score }, index) => {
          const title = publicJobDisplayTitle(job);
          const created = job.published_at || job.updated_at;
          return (
            <article key={job.public_job_token} className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${COLORS[index % COLORS.length]}`}>
                <Briefcase className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827]">{title}</p>
                <p className="text-xs text-[#6B7280]">
                  {branding.companyName}
                  {created
                    ? ` · Created on ${new Date(created).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-[#374151]">
                  {score}% Match{" "}
                  <span className="ml-2 rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-medium text-[#1D4ED8]">Open</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={applicationPath(`/jobs/${job.public_job_token}`, tenant)}
                  className={CANDIDATE_BTN_OUTLINE}
                >
                  Details
                </Link>
                <Link
                  href={applicationPath("/application/candidate/jobs", tenant)}
                  className={CANDIDATE_BTN_NAVY}
                >
                  Apply
                </Link>
              </div>
            </article>
          );
        })}
        {!loading && selected && matches.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No published jobs match this alert yet.</p>
        ) : null}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_20px_50px_rgba(18,27,33,0.2)]"
            onSubmit={(event) => {
              event.preventDefault();
              createAlert();
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Alert</h2>
              <button type="button" aria-label="Close" onClick={() => setCreateOpen(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs text-[#6B7280]">
              Alert name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-black"
                required
              />
            </label>
            <label className="mt-3 block text-xs text-[#6B7280]">
              Keywords, separated by commas
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-black"
                placeholder="Agile, Scrum, remote"
              />
            </label>
            <div className="mt-4 flex justify-end">
              <button type="submit" className={CANDIDATE_BTN_NAVY}>
                Save alert
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
