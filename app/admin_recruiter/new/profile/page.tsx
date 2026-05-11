"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Menu,
  RefreshCw,
  Search,
  Settings,
  UserPlus,
  Users,
  UserSquare2,
  X,
} from "lucide-react";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  city: string | null;
  state: string | null;
  status?: string | null;
};

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

const sidebarItems = [
  { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
  { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
  { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
  { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
] as const;

export default function ProfileIndexPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [query, setQuery] = useState("");
  const [listMode, setListMode] = useState<"new" | "all">("new");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const url = listMode === "new" ? "/api/workers?status=new" : "/api/workers";
        const res = await fetch(url);
        const json = (await res.json()) as { workers?: WorkerRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load workers");
        if (!cancelled) setWorkers(Array.isArray(json.workers) ? json.workers : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setWorkers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [listMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => {
      const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.toLowerCase();
      const loc = [w.city, w.state].filter(Boolean).join(" ").toLowerCase();
      return (
        name.includes(q) ||
        (w.job_role || "").toLowerCase().includes(q) ||
        loc.includes(q) ||
        w.id.toLowerCase().includes(q)
      );
    });
  }, [workers, query]);

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1F1C] text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-8 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-[#0A1F1C] font-bold text-3xl">N</span>
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tight">Nexus</div>
              <div className="text-xs text-teal-400 -mt-1">MedPro Staffing</div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-8 space-y-1">
            <div className="px-4 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              TEAM MANAGEMENT
            </div>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all ${
                    isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <div className="px-4 pt-10">
              <span className="flex items-center gap-3 px-4 py-3 text-sm text-white/50 rounded-2xl">
                <Settings className="w-5 h-5" /> Settings
              </span>
            </div>
          </nav>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden text-gray-600"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-3">
              <UserSquare2 className="w-6 h-6 text-teal-700" />
              <div>
                <div className="font-semibold text-xl text-gray-600">Applicant profile</div>
                <div className="text-xs text-gray-600">Choose a worker row to open Details</div>
              </div>
            </div>
          </div>
          <Link
            href="/admin_recruiter/new"
            className="text-sm text-teal-700 hover:underline flex items-center gap-1"
          >
            New applicants
            <ArrowRight className="w-4 h-4" />
          </Link>
        </header>

        <div className="flex-1 p-6 md:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-600">Worker table</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Data from <code className="text-xs bg-zinc-100 px-1 rounded">/api/workers</code> · Profile
                  route{" "}
                  <code className="text-xs bg-zinc-100 px-1 rounded">/admin_recruiter/new/profile/[id]</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  const url = listMode === "new" ? "/api/workers?status=new" : "/api/workers";
                  fetch(url)
                    .then((r) => r.json())
                    .then((json: { workers?: WorkerRow[] }) =>
                      setWorkers(Array.isArray(json.workers) ? json.workers : [])
                    )
                    .catch(() => setError("Refresh failed"))
                    .finally(() => setLoading(false));
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex rounded-2xl border border-zinc-200 bg-zinc-100/80 p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setListMode("new")}
                  className={`rounded-xl px-4 py-1.5 text-xs font-medium transition ${
                    listMode === "new" ? "bg-white shadow text-gray-600" : "text-gray-600 hover:text-gray-600"
                  }`}
                >
                  New only
                </button>
                <button
                  type="button"
                  onClick={() => setListMode("all")}
                  className={`rounded-xl px-4 py-1.5 text-xs font-medium transition ${
                    listMode === "all" ? "bg-white shadow text-gray-600" : "text-gray-600 hover:text-gray-600"
                  }`}
                >
                  All workers
                </button>
              </div>
              <div className="flex flex-1 items-center bg-white border border-zinc-200 rounded-2xl px-4 py-2.5 max-w-md">
                <Search className="w-5 h-5 text-gray-600 mr-2 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, role, location, or id"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-600"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
                {error}
              </div>
            ) : null}

            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-600 border-b border-zinc-100 bg-zinc-50/80">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Job role</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-16 text-center text-gray-600">
                          Loading workers…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-16 text-center text-gray-600">
                          No workers found.{" "}
                          <Link href="/admin_recruiter/new" className="text-teal-700 font-medium hover:underline">
                            Go to New applicants
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((w) => {
                        const name =
                          `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
                        const loc = [w.city, w.state].filter(Boolean).join(", ") || "—";
                        return (
                          <tr
                            key={w.id}
                            className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80"
                          >
                            <td className="px-5 py-3.5 font-medium text-gray-600">{name}</td>
                            <td className="px-4 py-3.5 text-gray-600">{w.job_role || "—"}</td>
                            <td className="px-4 py-3.5 text-gray-600">{loc}</td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                {titleCaseStatus(w.status)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Link
                                href={`/admin_recruiter/new/profile/${w.id}`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 transition"
                              >
                                Open
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-600">
              Total: {filtered.length}{" "}
              {query.trim() ? `(filtered from ${workers.length})` : `worker${workers.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
