"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidatesListShell } from "../components/CandidatesListShell";
import { useCandidatesFilterRowsDefault } from "../hooks/useCandidatesFilterRowsDefault";
import { staffFetchInit } from "@/lib/staff-auth-headers";

type PendingCandidate = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  email: string | null;
  phone: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  created_at: string | null;
  status?: string | null;
};

function displayName(row: PendingCandidate): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email || "Applicant";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
}

export default function ApprovedPendingConversionPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PendingCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [view, setView] = useState<"card" | "list">("list");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workers?status=approved&conversion=pending&limit=500", {
        ...(await staffFetchInit()),
        cache: "no-store",
      });
      const json = (await res.json()) as { workers?: PendingCandidate[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load approved candidates");
      setRows(json.workers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approved candidates");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const convertCandidate = async (candidateId: string, workerType: "w2" | "1099") => {
    setConvertingId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/candidates/${encodeURIComponent(candidateId)}/convert-worker`, {
        method: "POST",
        ...(await staffFetchInit()),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerType }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Conversion failed");
      await loadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConvertingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        displayName(row),
        row.email,
        row.user_email,
        row.phone,
        row.user_phone,
        row.job_role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const jobRoleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.job_role?.trim()) set.add(row.job_role.trim());
    }
    return Array.from(set).sort();
  }, [rows]);

  return (
    <CandidatesListShell
      query={query}
      onQueryChange={setQuery}
      onRefresh={() => void loadRows()}
      showFilterRows={showFilterRows}
      onToggleFilterRows={() => setShowFilterRows((v) => !v)}
      jobRoleFilter={jobRoleFilter}
      onJobRoleFilterChange={setJobRoleFilter}
      locationFilter={locationFilter}
      onLocationFilterChange={setLocationFilter}
      dateFilter={dateFilter}
      onDateFilterChange={setDateFilter}
      jobRoleOptions={jobRoleOptions}
      locationOptions={[]}
      view={view}
      onViewChange={setView}
      onEditColumns={() => undefined}
      onExportCsv={() => undefined}
      onExportXls={() => undefined}
      totalCount={rows.length}
      loading={loading}
      totalLabel="Approved pending conversion"
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      totalFiltered={filtered.length}
    >
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Applicant Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Job Title</th>
              <th className="px-4 py-3">Approved Date</th>
              <th className="px-4 py-3">Application Status</th>
              <th className="px-4 py-3">Convert to W-2</th>
              <th className="px-4 py-3">Convert to 1099</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#64748B]">
                  {loading ? "Loading..." : "No approved candidates pending conversion."}
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{displayName(row)}</td>
                  <td className="px-4 py-3 text-[#475569]">{row.email?.trim() || row.user_email?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-[#475569]">{row.phone?.trim() || row.user_phone?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-[#475569]">{row.job_role?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-[#475569]">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      Approved
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={convertingId === row.id}
                      onClick={() => void convertCandidate(row.id, "w2")}
                      className="rounded-md bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      W-2
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={convertingId === row.id}
                      onClick={() => void convertCandidate(row.id, "1099")}
                      className="rounded-md border border-[#0F766E] px-3 py-1.5 text-xs font-semibold text-[#0F766E] disabled:opacity-50"
                    >
                      1099
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin_recruiter/new/onboard-applicant/${row.id}`)}
                      className="text-xs font-semibold text-[#0F766E] hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </CandidatesListShell>
  );
}
