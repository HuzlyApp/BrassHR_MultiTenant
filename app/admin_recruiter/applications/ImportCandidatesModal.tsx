"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { FilterChipInput } from "@/app/admin_recruiter/components/FilterChipInput";
import {
  IMPORT_PAGE_SIZE_DEFAULT,
  IMPORT_RECOMMENDED_MIN_SCORE,
  IMPORT_SEARCH_DEBOUNCE_MS,
  type ImportCandidateView,
  type ImportExperienceBucket,
  type ImportSearchTab,
} from "@/lib/jobs/candidate-import-match";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

type ImportSearchResponse = {
  candidates: ImportCandidateView[];
  total: number;
  allTotal: number;
  recommendedTotal: number;
  page: number;
  pageSize: number;
  truncated: boolean;
  job: { id: string; title: string; jobRef: string };
  suggestedTags: string[];
  suggestedSkills: string[];
  suggestedRoles: string[];
  facets: {
    locations: string[];
    roles: string[];
    statuses: Array<{ id: string; name: string; color: string | null }>;
  };
};

type ImportCandidatesModalProps = {
  open: boolean;
  jobId: string;
  onClose: () => void;
  onImported?: () => void;
};

type FiltersState = {
  role: string;
  location: string;
  experience: ImportExperienceBucket | "";
  minMatch: number;
  status: string;
  previousTitle: string;
  skills: string[];
  tags: string[];
};

const EMPTY_FILTERS: FiltersState = {
  role: "",
  location: "",
  experience: "",
  minMatch: IMPORT_RECOMMENDED_MIN_SCORE,
  status: "",
  previousTitle: "",
  skills: [],
  tags: [],
};

function matchBadgeClass(score: number): string {
  if (score >= 90) return "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]";
  if (score >= 80) return "border-[#6EE7B7] bg-[#ECFDF5] text-[#047857]";
  if (score >= 70) return "border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]";
  return "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]";
}

export default function ImportCandidatesModal({
  open,
  jobId,
  onClose,
  onImported,
}: ImportCandidatesModalProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const primaryColor = branding.primaryHex || "#BC8B41";

  const [tab, setTab] = useState<ImportSearchTab>("recommended");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportCandidateView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ImportSearchResponse | null>(null);
  const [cachedRecommendedTotal, setCachedRecommendedTotal] = useState<number | null>(null);

  const resetState = useCallback(() => {
    setTab("recommended");
    setSearchInput("");
    setDebouncedQ("");
    setFilters({ ...EMPTY_FILTERS, minMatch: IMPORT_RECOMMENDED_MIN_SCORE });
    setPage(1);
    setSelectedIds([]);
    setPreview(null);
    setConfirmOpen(false);
    setLoading(false);
    setImporting(false);
    setError(null);
    setPayload(null);
    setCachedRecommendedTotal(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, resetState]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => setDebouncedQ(searchInput.trim()), IMPORT_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [open, searchInput]);

  const queryKey = useMemo(
    () =>
      JSON.stringify({
        tab,
        q: debouncedQ,
        page,
        filters,
      }),
    [tab, debouncedQ, page, filters]
  );

  useEffect(() => {
    if (!open || !jobId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("tab", tab);
        params.set("page", String(page));
        params.set("pageSize", String(IMPORT_PAGE_SIZE_DEFAULT));
        params.set("minMatch", String(filters.minMatch));
        if (debouncedQ) params.set("q", debouncedQ);
        if (filters.role) params.set("role", filters.role);
        if (filters.location) params.set("location", filters.location);
        if (filters.experience) params.set("experience", filters.experience);
        if (filters.status) params.set("status", filters.status);
        if (filters.previousTitle) params.set("previousTitle", filters.previousTitle);
        if (filters.skills.length) params.set("skills", filters.skills.join(","));
        if (filters.tags.length) params.set("tags", filters.tags.join(","));

        const response = await fetch(
          `/api/admin/jobs/${encodeURIComponent(jobId)}/candidates/import?${params.toString()}`,
          { credentials: "include" }
        );
        const json = (await response.json().catch(() => null)) as
          | ImportSearchResponse
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            json && "error" in json && json.error ? json.error : "Failed to search candidates"
          );
        }
        if (cancelled) return;
        const data = json as ImportSearchResponse;
        setPayload(data);
        if (tab === "recommended") setCachedRecommendedTotal(data.recommendedTotal);
      } catch (loadError) {
        if (!cancelled) {
          setPayload(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to search candidates");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, jobId, queryKey, tab, page, debouncedQ, filters]);

  const candidates = payload?.candidates ?? [];
  const selectableIds = candidates.filter((row) => !row.alreadyAdded).map((row) => row.id);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const pageCount = Math.max(1, Math.ceil((payload?.total ?? 0) / IMPORT_PAGE_SIZE_DEFAULT));
  const rangeStart = payload && payload.total ? (payload.page - 1) * payload.pageSize + 1 : 0;
  const rangeEnd = payload ? Math.min(payload.page * payload.pageSize, payload.total) : 0;

  const closeModal = useCallback(() => {
    if (importing || confirmOpen) return;
    if (preview) {
      setPreview(null);
      return;
    }
    onClose();
  }, [confirmOpen, importing, onClose, preview]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeModal]);

  function updateFilter<K extends keyof FiltersState>(key: K, value: FiltersState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function switchTab(next: ImportSearchTab) {
    setTab(next);
    setPage(1);
    setPreview(null);
    setFilters((current) => ({
      ...current,
      minMatch: next === "recommended" ? IMPORT_RECOMMENDED_MIN_SCORE : 0,
    }));
  }

  function toggleId(id: string, alreadyAdded: boolean) {
    if (alreadyAdded) return;
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !selectableIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...selectableIds])));
  }

  async function confirmImport(ids: string[]) {
    const candidateIds = ids.filter(Boolean);
    if (!candidateIds.length || importing) return;
    setImporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}/candidates/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds }),
      });
      const json = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(json?.error || "Failed to import candidates");
      }
      toast.success(json?.message || "Candidates successfully added.");
      setSelectedIds([]);
      setPreview(null);
      setConfirmOpen(false);
      onImported?.();
      onClose();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Failed to import candidates");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const recommendedLabel =
    cachedRecommendedTotal == null ? "Recommended" : `Recommended (${cachedRecommendedTotal})`;
  const allLabel = payload ? `All Candidates (${payload.allTotal})` : "All Candidates";
  const jobTitle = payload?.job.title || "this job";
  const jobRef = payload?.job.jobRef || "";

  const modal = (
    <div className="fixed inset-0 z-[130]" style={brandVars}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close import candidates"
        disabled={importing}
        onClick={() => {
          if (!importing) onClose();
        }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-stretch justify-center p-0 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-candidates-title"
          className="pointer-events-auto flex h-full w-full max-w-[1200px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(880px,calc(100vh-48px))] sm:rounded-[20px] sm:border sm:border-[#E5E7EB]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
            <div>
              <h2 id="import-candidates-title" className="text-xl font-semibold text-[#101828]">
                Import Candidates
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                Search your talent database and add existing candidates to{" "}
                <span className="font-medium text-[#334155]">{jobTitle}</span>
                {jobRef ? ` — Job ID ${jobRef}` : ""}.
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              disabled={importing}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#101828] text-white disabled:opacity-60"
              aria-label="Close"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {preview ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[#101828]">{preview.fullName}</p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {[preview.currentRole, preview.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${matchBadgeClass(preview.matchScore)}`}
                  >
                    {preview.matchScore}% match
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A]">Why they match</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {preview.matchReasons.length ? (
                    preview.matchReasons.map((reason) => <li key={reason}>{reason}</li>)
                  ) : (
                    <li>Partial overlap with job title and description</li>
                  )}
                </ul>
                {preview.topSkills.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Skills</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {preview.topSkills.map((skill) => (
                        <span key={skill} className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#334155]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {preview.tags.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Tags</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {preview.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#475569]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 text-sm text-[#334155]">
                  <p>
                    <span className="font-medium">Experience:</span>{" "}
                    {preview.yearsExperience != null ? `${preview.yearsExperience} years` : "Unknown"}
                  </p>
                  {preview.experienceHighlights.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[#475569]">
                      {preview.experienceHighlights.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#334155]"
                    onClick={() => setPreview(null)}
                  >
                    Back to Results
                  </button>
                  <button
                    type="button"
                    disabled={preview.alreadyAdded}
                    className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      if (preview.alreadyAdded) return;
                      setSelectedIds((current) =>
                        current.includes(preview.id) ? current : [...current, preview.id]
                      );
                      setConfirmOpen(true);
                    }}
                  >
                    Add Candidate
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-[#E5E7EB] px-5 pt-4 sm:px-6">
                  <div className="flex gap-6">
                    {(["recommended", "all"] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => switchTab(id)}
                        className={`relative pb-3 text-sm font-medium ${
                          tab === id ? "text-[#0F172A]" : "text-[#64748B]"
                        }`}
                      >
                        {id === "recommended" ? recommendedLabel : allLabel}
                        {tab === id ? (
                          <span
                            className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={searchInput}
                      onChange={(event) => {
                        setSearchInput(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search candidates..."
                      className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-medium text-[#64748B]">
                      Role
                      <select
                        value={filters.role}
                        onChange={(event) => updateFilter("role", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
                      >
                        <option value="">Any role</option>
                        {(payload?.facets.roles ?? []).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#64748B]">
                      Location
                      <select
                        value={filters.location}
                        onChange={(event) => updateFilter("location", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
                      >
                        <option value="">Any location</option>
                        {(payload?.facets.locations ?? []).map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#64748B]">
                      Experience
                      <select
                        value={filters.experience}
                        onChange={(event) =>
                          updateFilter("experience", event.target.value as ImportExperienceBucket | "")
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
                      >
                        <option value="">Any experience</option>
                        <option value="under3">Under 3 years</option>
                        <option value="3to5">3–5 years</option>
                        <option value="5to10">5–10 years</option>
                        <option value="10plus">10+ years</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#64748B]">
                      Match Score
                      <select
                        value={String(filters.minMatch)}
                        onChange={(event) => updateFilter("minMatch", Number(event.target.value))}
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
                      >
                        {tab === "all" ? <option value="0">Any match</option> : null}
                        <option value="60">60%+ Possible</option>
                        <option value="70">70%+ Good</option>
                        <option value="80">80%+ Strong</option>
                        <option value="90">90%+ Excellent</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#64748B]">
                      Status
                      <select
                        value={filters.status}
                        onChange={(event) => updateFilter("status", event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155]"
                      >
                        <option value="">Any status</option>
                        {(payload?.facets.statuses ?? []).map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-[#64748B]">
                      Previous title
                      <input
                        value={filters.previousTitle}
                        onChange={(event) => updateFilter("previousTitle", event.target.value)}
                        placeholder="Previous job title"
                        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#334155] outline-none"
                      />
                    </label>
                    <div className="text-xs font-medium text-[#64748B] sm:col-span-2">
                      Skills
                      <div className="mt-1">
                        <FilterChipInput
                          values={filters.skills}
                          suggestions={payload?.suggestedSkills ?? []}
                          placeholder="Add a skill"
                          onChange={(skills) => updateFilter("skills", skills)}
                        />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-[#64748B] sm:col-span-2">
                      Tags
                      <div className="mt-1">
                        <FilterChipInput
                          values={filters.tags}
                          suggestions={payload?.suggestedTags ?? []}
                          placeholder="Add a tag"
                          onChange={(tags) => updateFilter("tags", tags)}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#64748B] underline-offset-2 hover:underline"
                    onClick={() => {
                      setFilters({
                        ...EMPTY_FILTERS,
                        minMatch: tab === "recommended" ? IMPORT_RECOMMENDED_MIN_SCORE : 0,
                      });
                      setPage(1);
                    }}
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-[#64748B]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching candidates…
                    </div>
                  ) : error ? (
                    <p className="px-6 py-10 text-center text-sm text-[#B91C1C]">{error}</p>
                  ) : !candidates.length ? (
                    <div className="px-6 py-16 text-center">
                      <p className="text-sm font-medium text-[#0F172A]">No candidates found</p>
                      <p className="mt-1 text-sm text-[#64748B]">
                        Try changing your search or removing some filters.
                      </p>
                    </div>
                  ) : (
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        <tr>
                          <th className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleSelectAllVisible}
                              aria-label="Select all visible candidates"
                            />
                          </th>
                          <th className="px-3 py-3">Candidate</th>
                          <th className="px-3 py-3">Current Role</th>
                          <th className="px-3 py-3">Location</th>
                          <th className="px-3 py-3">Experience</th>
                          <th className="px-3 py-3">Top Skills</th>
                          <th className="px-3 py-3">Tags</th>
                          <th className="px-3 py-3">Match</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((row) => {
                          const selected = selectedIds.includes(row.id);
                          return (
                            <tr
                              key={row.id}
                              className={`cursor-pointer border-t border-[#E5E7EB] ${
                                row.alreadyAdded ? "bg-[#F8FAFC] text-[#94A3B8]" : "hover:bg-[#F8FAFC]"
                              }`}
                              onClick={() => setPreview(row)}
                            >
                              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={row.alreadyAdded}
                                  aria-label={`Select ${row.fullName}`}
                                  onChange={() => toggleId(row.id, row.alreadyAdded)}
                                />
                              </td>
                              <td className="px-3 py-3 font-medium text-[#0F172A]">
                                <span className={row.alreadyAdded ? "text-[#94A3B8]" : ""}>{row.fullName}</span>
                                {row.alreadyAdded ? (
                                  <span className="ml-2 inline-flex rounded-full border border-[#CBD5E1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                                    Already Added
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 text-[#475569]">{row.currentRole || "—"}</td>
                              <td className="px-3 py-3 text-[#475569]">{row.location || "—"}</td>
                              <td className="px-3 py-3 text-[#475569]">
                                {row.yearsExperience != null ? `${row.yearsExperience} yrs` : "—"}
                              </td>
                              <td className="px-3 py-3 text-[#475569]">
                                {row.topSkills.slice(0, 3).join(", ") || "—"}
                              </td>
                              <td className="px-3 py-3 text-[#475569]">{row.tags.slice(0, 3).join(", ") || "—"}</td>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${matchBadgeClass(row.matchScore)}`}
                                >
                                  {row.matchScore}%
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                  style={{ backgroundColor: row.statusColor || "#64748B" }}
                                >
                                  {row.statusName}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          {!preview ? (
            <div className="flex flex-col gap-3 border-t border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-[#64748B]">
                {payload
                  ? `Showing ${rangeStart}–${rangeEnd} of ${payload.total} candidates${
                      payload.truncated ? " (top matches in this search)" : ""
                    }`
                  : "Searching…"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {pageCount > 1 ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#CBD5E1] px-3 text-sm disabled:opacity-50"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#CBD5E1] px-3 text-sm disabled:opacity-50"
                      disabled={page >= pageCount}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={!selectedIds.length || importing}
                  className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setConfirmOpen(true)}
                >
                  Import selected ({selectedIds.length})
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {confirmOpen ? (
        <div className="absolute inset-0 z-[140] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-confirm-title"
            className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="import-confirm-title" className="text-lg font-semibold text-[#101828]">
              Add candidates to this job?
            </h3>
            <p className="mt-2 text-sm text-[#475569]">
              These candidates will be added to {jobTitle}
              {jobRef ? ` — Job ID ${jobRef}` : ""}.
            </p>
            <p className="mt-3 text-sm font-medium text-[#0F172A]">
              {selectedIds.length} candidate{selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-sm text-[#475569]">
              {selectedIds.length} candidate{selectedIds.length === 1 ? "" : "s"} will be imported
            </p>
            <p className="mt-2 text-xs text-[#64748B]">
              Candidates already on this job are skipped automatically.
            </p>
            {error ? <p className="mt-3 text-sm text-[#B91C1C]">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={importing}
                className="inline-flex h-10 items-center rounded-lg border border-[#CBD5E1] px-4 text-sm font-medium text-[#334155]"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || !selectedIds.length}
                className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
                onClick={() => void confirmImport(selectedIds)}
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
