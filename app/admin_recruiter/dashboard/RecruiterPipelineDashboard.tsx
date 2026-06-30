"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ArrowRight,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  city: string | null;
  state: string | null;
  created_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** Worker pipeline stats — available for reuse outside the main dashboard. */
export default function RecruiterPipelineDashboard() {
  const branding = useTenantBranding();
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState({
    new: 0,
    pending: 0,
    approved: 0,
    disapproved: 0,
  });

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const [allRes, cNew, cPending, cApproved, cDisapproved] = await Promise.all([
          fetch("/api/workers"),
          fetch("/api/workers?status=new&head=1"),
          fetch("/api/workers?status=pending&head=1"),
          fetch("/api/workers?status=approved&head=1"),
          fetch("/api/workers?status=disapproved&head=1"),
        ]);

        const allJson = await allRes.json();
        const authError =
          allRes.status === 401 ||
          allRes.status === 403 ||
          String(allJson?.error ?? "").toLowerCase() === "unauthorized" ||
          String(allJson?.detail ?? "").toLowerCase().includes("staff role required");
        if (authError) {
          setWorkers([]);
          setCounts({ new: 0, pending: 0, approved: 0, disapproved: 0 });
          return;
        }
        if (!allRes.ok) throw new Error(allJson?.error || "Failed to load workers");
        const list = Array.isArray(allJson)
          ? (allJson as WorkerRow[])
          : Array.isArray(allJson?.workers)
            ? (allJson.workers as WorkerRow[])
            : [];
        setWorkers(list);

        const parseTotal = async (r: Response) => {
          const j = await r.json().catch(() => ({}));
          return typeof j?.total === "number" ? j.total : 0;
        };
        const [n, p, a, d] = await Promise.all([
          parseTotal(cNew),
          parseTotal(cPending),
          parseTotal(cApproved),
          parseTotal(cDisapproved),
        ]);
        setCounts({ new: n, pending: p, approved: a, disapproved: d });
      } catch (e) {
        console.error("Failed to load dashboard workers:", e);
        setWorkers([]);
        setCounts({ new: 0, pending: 0, approved: 0, disapproved: 0 });
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => {
      const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim().toLowerCase();
      const role = (w.job_role ?? "").toLowerCase();
      const loc = `${w.city ?? ""} ${w.state ?? ""}`.trim().toLowerCase();
      return name.includes(q) || role.includes(q) || loc.includes(q);
    });
  }, [workers, query]);

  const recent = useMemo(() => filtered.slice(0, 6), [filtered]);

  return (
    <div className="px-5 py-6 lg:px-8">
      <div className="w-full">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-4xl font-semibold leading-[42px] text-[#1d2739]">Workers</h1>
          <p className="text-sm text-[#6f7683]">Quick access to applicant pipelines and workers</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex h-10 w-full sm:w-[420px] items-center rounded-md border border-[#dce6e3] bg-white px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workers by name, role, location"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
          <Link
            href="/admin_recruiter/advanced-search"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <MapPin className="h-4 w-4" />
            Advanced search
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Link
            href="/admin_recruiter/workers"
            className="min-h-[132px] rounded-2xl border border-[#E5E7EB] bg-white p-4 transition hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6b7280]">Total workers</p>
              <Sparkles className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
            </div>
            <p className="mt-2 text-[38px] font-semibold leading-10 text-[#1f2937]">{loading ? "—" : workers.length}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
              View workers
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          {[
            { key: "new" as const, label: "New applicants", href: "/admin_recruiter/new", chip: "New", chipClass: "border border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]" },
            { key: "pending" as const, label: "Pending applicants", href: "/admin_recruiter/pending", chip: "Pending", chipClass: "border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white" },
            { key: "approved" as const, label: "Approved applicants", href: "/admin_recruiter/approved", chip: "Approved", chipClass: "border border-[#22C55E] bg-[#22C55E] text-white" },
            { key: "disapproved" as const, label: "Disapproved applicants", href: "/admin_recruiter/disapproved", chip: "Disapproved", chipClass: "border border-[#FB7185] bg-[#FB7185] text-white" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="min-h-[132px] rounded-2xl border border-[#E5E7EB] bg-white p-4 transition hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-[#6b7280]">{c.label}</p>
                <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${c.chipClass}`}>{c.chip}</span>
              </div>
              <p className="mt-2 text-[38px] font-semibold leading-10 text-[#1f2937]">{loading ? "—" : counts[c.key]}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
                Open list
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#D9DEE5] bg-white">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Recent workers</h2>
              <p className="text-sm text-[#6B7280]">
                Showing {recent.length} of {filtered.length}
              </p>
            </div>
            <Link
              href="/admin_recruiter/workers"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              style={{ color: branding.primaryHex }}
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? null : recent.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[#6B7280]">No workers found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[760px] w-full border-collapse">
                <thead className="bg-[#F8FAFC]">
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Name</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Job Role</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Created</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((w) => {
                    const name =
                      `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
                    const location = [w.city, w.state].filter(Boolean).join(", ") || "—";
                    return (
                      <tr key={w.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{name}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{w.job_role || "—"}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{formatDate(w.created_at)}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{location}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
