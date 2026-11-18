"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  CandidateFindJobsView,
  formatCandidatePay,
  formatCandidatePostedLabel,
  type CandidateJobCardModel,
} from "./CandidateFindJobsView";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { applicantPortalApiPath, resolveApplicantPortalTenantSlug } from "@/lib/applicant-portal/client-tenant";
import type { WorkerJobApplicationListItem } from "@/lib/applicant-portal/list-worker-job-applications";
import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";
import {
  normalizeJobToken,
  publicJobDisplayTitle,
} from "@/lib/jobs/public-application-routing";
import { useUsLocationOptions } from "@/lib/location/use-us-location-options";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WORKER_BTN_OUTLINE, WORKER_BTN_PRIMARY } from "./worker-portal-buttons";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";
import { normalizeStateCode } from "@/lib/service-area/normalize";
import { useServiceAreaPreview } from "@/lib/service-area/use-service-area-preview";

type PublicJob = {
  id?: string;
  public_job_token: string;
  public_title: string;
  source_job_title?: string | null;
  source_type?: string | null;
  public_description: string | null;
  location: string | null;
  location_type?: string | null;
  schedule: string | null;
  employment_type: string | null;
  published_at: string | null;
  application_deadline?: string | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  pay_rate?: number | null;
  pay_rate_period?: string | null;
  rate_unit?: string | null;
  qualifications?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  professions: { name?: string } | { name?: string }[] | null;
  specialties: { name?: string } | { name?: string }[] | null;
};

type WorkerJobRow = {
  job: PublicJob;
  token: string;
  title: string;
  location: string;
  employmentType: string;
  profession: string;
  specialty: string;
  description: string;
  publishedAt: string | null;
  application: WorkerJobApplicationListItem | null;
  applied: boolean;
};

type RelocateChoice = "onsite" | "relocate" | "remote";

const APPLY_ZIP_INPUT_CLASS =
  "mt-1 h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

const APPLY_RADIO_CLASS =
  "h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--brand-checkbox,var(--brand-primary))]";

function relationName(value: PublicJob["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() || "";
}

function ApplyConfirmModal({
  open,
  jobTitle,
  jobLocation,
  submitting,
  error,
  workCity,
  workState,
  workPostal,
  relocate,
  previewMessage,
  previewLoading,
  submitDisabled,
  onWorkCity,
  onWorkState,
  onWorkPostal,
  onRelocate,
  onClose,
  onConfirm,
}: {
  open: boolean;
  jobTitle: string;
  jobLocation: string;
  submitting: boolean;
  error: string | null;
  workCity: string;
  workState: string;
  workPostal: string;
  relocate: RelocateChoice | "";
  previewMessage: string | null;
  previewLoading: boolean;
  submitDisabled: boolean;
  onWorkCity: (value: string) => void;
  onWorkState: (value: string) => void;
  onWorkPostal: (value: string) => void;
  onRelocate: (value: RelocateChoice) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const {
    stateOptions,
    cityOptions,
    locationLoading,
    citiesLoading,
    displayStateValue,
  } = useUsLocationOptions(workState, open);

  const effectiveCityOptions = useMemo(() => {
    const current = workCity.trim();
    if (!current || cityOptions.includes(current)) return cityOptions;
    return [...cityOptions, current].sort((a, b) => a.localeCompare(b));
  }, [workCity, cityOptions]);

  useEffect(() => {
    if (!open) return;
    const current = workCity.trim();
    if (!current || cityOptions.length === 0) return;
    if (cityOptions.includes(current)) return;
    const match = cityOptions.find(
      (option) => option.toLowerCase() === current.toLowerCase()
    );
    if (match) onWorkCity(match);
  }, [open, workCity, cityOptions, onWorkCity]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-apply-job-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="worker-apply-job-title" className="text-base font-semibold text-[#0F172A]">
              Apply for job
            </h3>
            <p className="mt-1 break-words text-sm text-[#64748B]" title={jobTitle}>
              {jobTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <p className="text-sm text-[#64748B]">
            Confirm where you will work this job. Home address, school, and travel city are not used.
            Your latest uploaded resume from Documents will be attached automatically.
          </p>

          <SearchableSelectField
            label="Work state"
            required
            compact
            loading={locationLoading}
            disabled={submitting || locationLoading}
            value={displayStateValue}
            onChange={(value) => {
              onWorkState(value);
              onWorkCity("");
            }}
            placeholder="Search state"
            searchPlaceholder="Type to search states"
            options={stateOptions}
            emptyMessage="No states found. Try another search."
          />

          <SearchableSelectField
            label="Work city"
            required
            compact
            loading={citiesLoading}
            disabled={
              submitting ||
              !displayStateValue ||
              citiesLoading ||
              (!cityOptions.length && !workCity.trim())
            }
            value={workCity}
            onChange={onWorkCity}
            placeholder={
              !displayStateValue
                ? "Select state first"
                : citiesLoading
                  ? "Loading…"
                  : "Search city"
            }
            searchPlaceholder="Type to search cities"
            options={effectiveCityOptions}
            emptyMessage="No cities found. Try another search."
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#0F172A]" htmlFor="worker-work-zip">
              ZIP (optional)
            </label>
            <input
              id="worker-work-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              className={APPLY_ZIP_INPUT_CLASS}
              value={workPostal}
              disabled={submitting}
              onChange={(event) => onWorkPostal(event.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Code"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-[#0F172A]">
              Will you work on-site{jobLocation ? ` at ${jobLocation}` : ""}?
            </legend>
            {(
              [
                { value: "onsite", label: "Yes" },
                { value: "relocate", label: "Yes, I will relocate" },
                { value: "remote", label: "No, I would work remote from the location above" },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm text-[#334155]"
              >
                <input
                  type="radio"
                  name="worker-relocate"
                  className={APPLY_RADIO_CLASS}
                  checked={relocate === option.value}
                  disabled={submitting}
                  onChange={() => onRelocate(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {previewMessage ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {previewMessage}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E5E7EB] px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-5">
          <button type="button" disabled={submitting} onClick={onClose} className={WORKER_BTN_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={submitDisabled || submitting || previewLoading}
            className={WORKER_BTN_PRIMARY}
            onClick={onConfirm}
          >
            {submitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CandidateJobsClient() {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const branding = useTenantBranding();
  const searchParams = useSearchParams();
  const tenantSlug =
    branding.slug?.trim().toLowerCase() || resolveApplicantPortalTenantSlug() || "";
  const initialQuery = (searchParams?.get("q") ?? "").trim();

  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [applications, setApplications] = useState<WorkerJobApplicationListItem[]>([]);

  const [applyJob, setApplyJob] = useState<WorkerJobRow | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [workCity, setWorkCity] = useState("");
  const [workState, setWorkState] = useState("");
  const [workPostal, setWorkPostal] = useState("");
  const [relocate, setRelocate] = useState<RelocateChoice | "">("");

  const applyLocation = useMemo(() => {
    const stateCode = normalizeStateCode(workState);
    return applyJob && workCity.trim() && stateCode && relocate
      ? {
          city: workCity.trim(),
          state: stateCode,
          postalCode: workPostal.trim() || undefined,
          locationType: relocate === "remote" ? ("remote" as const) : ("onsite" as const),
          relocateToJobSite: relocate === "relocate" || relocate === "onsite",
        }
      : null;
  }, [applyJob, workCity, workState, workPostal, relocate]);
  const applyPreview = useServiceAreaPreview(applyLocation, "apply", {
    jobToken: applyJob?.token,
    tenantSlug,
    publicClient: true,
    enabled: Boolean(applyJob),
  });

  useEffect(() => {
    const next = (searchParams?.get("q") ?? "").trim();
    setQuery(next);
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    if (!tenantSlug) {
      setError("Tenant could not be resolved. Refresh the page and try again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const params = new URLSearchParams({
        tenant: tenantSlug,
        page: "1",
        pageSize: "50",
      });
      if (query.trim()) params.set("q", query.trim());
      if (location.trim()) params.set("location", location.trim());
      if (employmentType) params.set("employmentType", employmentType);

      const [jobsRes, appsRes] = await Promise.all([
        fetch(`/api/public/jobs?${params}`, { cache: "no-store" }),
        fetch(applicantPortalApiPath("/api/applicant-portal/applications"), {
          headers,
          cache: "no-store",
        }),
      ]);

      const jobsPayload = (await jobsRes.json().catch(() => ({}))) as {
        jobs?: PublicJob[];
        error?: string;
      };
      const appsPayload = (await appsRes.json().catch(() => ({}))) as {
        applications?: WorkerJobApplicationListItem[];
        error?: string;
      };

      if (!jobsRes.ok) throw new Error(jobsPayload.error || "Could not load active jobs.");
      if (!appsRes.ok) throw new Error(appsPayload.error || "Could not load applications.");

      setJobs(jobsPayload.jobs ?? []);
      setApplications(appsPayload.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load jobs.");
      setJobs([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, employmentType, location, query, sessionReady, tenantSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applicationByJobId = useMemo(() => {
    const map = new Map<string, WorkerJobApplicationListItem>();
    for (const app of applications) {
      const key = app.jobRequisitionId.trim();
      if (key && !map.has(key)) map.set(key, app);
    }
    return map;
  }, [applications]);

  const rows = useMemo<WorkerJobRow[]>(() => {
    return jobs
      .map((job) => {
        const token = normalizeJobToken(job.public_job_token) || "";
        const jobId = String(job.id ?? "").trim();
        const application = jobId ? applicationByJobId.get(jobId) ?? null : null;
        return {
          job,
          token,
          title: publicJobDisplayTitle(job),
          location: job.location?.trim() || "—",
          employmentType: job.employment_type?.trim() || "",
          profession: relationName(job.professions),
          specialty: relationName(job.specialties),
          description: jobDescriptionPlainText(job.public_description || ""),
          publishedAt: job.published_at,
          application,
          applied: Boolean(application),
        };
      })
      .filter((row) => Boolean(row.token));
  }, [applicationByJobId, jobs]);

  function openApplyModal(row: WorkerJobRow) {
    if (row.applied) return;
    setApplyJob(row);
    setApplyError(null);
    setWorkCity("");
    setWorkState("");
    setWorkPostal("");
    setRelocate("");
  }

  async function submitApplication() {
    if (!applyJob || !applyLocation || applyPreview.allowed === false) return;
    setApplying(true);
    setApplyError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(applicantPortalApiPath("/api/applicant-portal/jobs/apply"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jobToken: applyJob.token, workLocation: applyLocation }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string | { messageKey?: string; code?: string };
      };
      if (!res.ok) {
        const message =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.messageKey
              ? SERVICE_AREA_COPY[payload.error.messageKey as keyof typeof SERVICE_AREA_COPY] ??
                SERVICE_AREA_COPY.location_not_available
              : "Could not apply for this job.";
        throw new Error(message);
      }
      setApplyJob(null);
      await load();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not apply for this job.");
    } finally {
      setApplying(false);
    }
  }

  const jobCards: CandidateJobCardModel[] = rows.map((row) => ({
    key: row.token,
    token: row.token,
    title: row.title,
    location: row.location,
    employmentType: row.employmentType,
    locationType: row.job.location_type?.trim() || "",
    postedLabel: formatCandidatePostedLabel(row.publishedAt),
    payLabel: formatCandidatePay(row.job),
    descriptionHtml: row.job.public_description || "",
    qualifications: row.job.qualifications || "",
    responsibilities: row.job.responsibilities || "",
    benefits: row.job.benefits || "",
    applied: row.applied,
  }));

  return (
    <>
      <CandidateFindJobsView
        companyName={branding.companyName || "Open roles"}
        jobs={jobCards}
        loading={loading}
        error={error}
        query={query}
        location={location}
        employmentType={employmentType}
        onQueryChange={setQuery}
        onLocationChange={setLocation}
        onEmploymentTypeChange={setEmploymentType}
        onSearch={() => void load()}
        onApply={(token) => {
          const row = rows.find((item) => item.token === token);
          if (row) openApplyModal(row);
        }}
      />

      <ApplyConfirmModal
        open={Boolean(applyJob)}
        jobTitle={applyJob?.title || ""}
        jobLocation={applyJob?.location || ""}
        submitting={applying}
        error={applyError}
        workCity={workCity}
        workState={workState}
        workPostal={workPostal}
        relocate={relocate}
        previewMessage={applyPreview.message}
        previewLoading={applyPreview.loading}
        submitDisabled={!applyLocation || applyPreview.allowed === false || applyPreview.loading}
        onWorkCity={setWorkCity}
        onWorkState={setWorkState}
        onWorkPostal={setWorkPostal}
        onRelocate={setRelocate}
        onClose={() => {
          if (applying) return;
          setApplyJob(null);
          setApplyError(null);
        }}
        onConfirm={() => void submitApplication()}
      />
    </>
  );
}
