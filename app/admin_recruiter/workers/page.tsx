"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Loader2,
} from "lucide-react";

type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2?: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  created_at: string | null;
  status?: string | null;
};

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      location: string;
      status: string;
    }>
  >([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newOnly, setNewOnly] = useState(true);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(newOnly ? "/api/workers?worker_status=new" : "/api/workers", {
        cache: "no-store",
      });
      const data = await res.json();
      const authError =
        res.status === 401 ||
        res.status === 403 ||
        String(data?.error ?? "").toLowerCase() === "unauthorized" ||
        String(data?.detail ?? "").toLowerCase().includes("staff role required");
      if (authError) {
        setWorkers([]);
        setTotalFromApi(0);
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");

      const list: WorkerProfile[] = Array.isArray(data?.workers)
        ? data.workers
        : Array.isArray(data)
          ? data
          : [];
      setTotalFromApi(typeof data?.total === "number" ? data.total : list.length);

      const mapped = list.map((w) => {
        const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
        const location = [w.city, w.state].filter(Boolean).join(", ") || "—";
        return {
          id: w.id,
          name,
          role: w.job_role || "—",
          location,
          status: titleCaseStatus(w.status ?? (newOnly ? "new" : "—")),
        };
      });
      setWorkers(mapped);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setWorkers([]);
      setTotalFromApi(null);
    } finally {
      setLoading(false);
    }
  }, [newOnly]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const filtered = useMemo(() => {
    let out = workers;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      });
    }
    return out;
  }, [workers, query]);

  return (
    <div className="p-4 sm:p-5"> 
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-[36px] font-semibold leading-10 tracking-normal text-[#1d2739]">Worker table</h1>
          <div className="text-sm text-[#6f7683] mt-1">
            Data from <code className="bg-zinc-100 px-1 rounded">/api/workers</code> · Profile route{" "}
            <code className="bg-zinc-100 px-1 rounded">/admin_recruiter/workers/[id]/profile</code>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadWorkers()}
            className="h-10 inline-flex items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-semibold text-[#3d4a4a] hover:bg-zinc-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((v) => !v)}
              className="flex items-center justify-center w-10 h-10 border border-[#dce6e3] bg-white hover:bg-zinc-50 rounded-md transition"
              aria-label="More actions"
            >
              <Image src="/icons/admin-recruiter/candidates/three-dot.svg" alt="" width={16} height={16} />
            </button>
            {moreMenuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setMoreMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-zinc-200 bg-white py-2 shadow-lg">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
                    onClick={() => {
                      setMoreMenuOpen(false);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Create worker
                    </span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="w-full shrink-0 rounded-md border border-[#E5E7EB] bg-white overflow-hidden flex flex-col">
        <div className="min-h-[60px] border-b border-[#E5E7EB] p-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewOnly(true)}
              className={`h-8 px-3 rounded-md text-xs border font-semibold ${
                newOnly ? "bg-[#0c918a] border-[#0c918a] text-white" : "bg-white border-[#dce6e3] text-[#3d4a4a]"
              }`}
            >
              New only
            </button>
            <button
              type="button"
              onClick={() => setNewOnly(false)}
              className={`h-8 px-3 rounded-md text-xs border font-semibold ${
                !newOnly ? "bg-[#0c918a] border-[#0c918a] text-white" : "bg-white border-[#dce6e3] text-[#3d4a4a]"
              }`}
            >
              All workers
            </button>
          </div>

          <div className="flex items-center bg-white border border-[#dce6e3] rounded-md px-3 h-8 w-full sm:max-w-[320px]">
            <Search className="w-4 h-4 text-[#94A3B8] mr-2 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role, location, or id"
              className="bg-transparent outline-none flex-1 min-w-0 text-xs text-[#334155] placeholder:text-[#94A3B8]"
            />
          </div>
        </div>

        <div className="bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              Loading workers...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-600">No workers found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[760px] w-full border-collapse">
                <thead className="bg-[#F8FAFC]">
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Name</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Job role</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Location</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-black">Status</th>
                    <th className="bg-[#E5E7EB] px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-black">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => (
                    <tr key={w.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                      <td className="px-4 py-4 text-sm font-medium text-[#111827]">{w.name}</td>
                      <td className="px-4 py-4 text-sm text-[#374151]">{w.role}</td>
                      <td className="px-4 py-4 text-sm text-[#374151]">{w.location}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border border-[#E5E7EB] text-[#111827]">
                          {w.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin_recruiter/workers/${w.id}/profile`}
                          className="inline-flex items-center gap-1 rounded-full bg-[#0c918a] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#0a7b75]"
                        >
                          Open <span aria-hidden>-&gt;</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-600">
        Total: {loading ? "—" : totalFromApi ?? workers.length} workers
      </div>
    </div>
  );
}
