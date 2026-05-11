"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  job_role: string;
  lat: number;
  lng: number;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  address1?: string | null;
  distance_meters?: number | null;
};

const sidebarItems = [
  { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
  { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
  { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
  { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
  { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
  { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
  { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
] as const;

export default function ResultsClient() {
  const pathname = usePathname();
  const params = useSearchParams();

  const lat = Number(params.get("lat") ?? "");
  const lng = Number(params.get("lng") ?? "");
  const radius = Number(params.get("radius") ?? "10");
  const place = params.get("place") ?? "";

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    return "Failed to fetch results";
  }

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
          throw new Error("Missing or invalid search parameters");
        }
        const res = await fetch("/api/search-workers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            radius,
            ...(place.trim() ? { place: place.trim() } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Search failed");
        setWorkers(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setWorkers([]);
        setError(toMessage(e));
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [lat, lng, radius, place]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const placeQ = (place || "").trim().toLowerCase();
    const base = !q
      ? workers
      : workers.filter((w) => {
          const name = `${w.first_name} ${w.last_name}`.toLowerCase();
          const role = (w.job_role || "").toLowerCase();
          const loc = `${w.city ?? ""} ${w.state ?? ""} ${w.address1 ?? ""} ${w.address ?? ""}`.toLowerCase();
          return name.includes(q) || role.includes(q) || loc.includes(q);
        });
    // Match any comma-separated segment (e.g. "Davao City" from "Davao City, Philippines")
    const placeFiltered = !placeQ
      ? base
      : base.filter((w) => {
          const loc = `${w.city ?? ""} ${w.state ?? ""} ${w.address1 ?? ""} ${w.address ?? ""}`.toLowerCase();
          const segments = place
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length >= 2);
          return (
            segments.some((seg) => loc.includes(seg)) ||
            loc.includes(placeQ)
          );
        });
    return [...placeFiltered].sort((a, b) => {
      const ad = typeof a.distance_meters === "number" ? a.distance_meters : Number.POSITIVE_INFINITY;
      const bd = typeof b.distance_meters === "number" ? b.distance_meters : Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }, [workers, query, place]);

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden text-gray-600">
      <div className="fixed inset-y-0 left-0 z-40 w-72 bg-[#0A1F1C] text-white hidden lg:block">
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
                key={`${item.href}-${item.label}`}
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
        </nav>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div>
            <div className="font-semibold text-2xl">Candidates</div>
            <div className="text-xs text-gray-600">Admin - Advanced Search Results</div>
          </div>
          <Link
            href="/admin_recruiter/advanced-search"
            className="text-sm text-teal-700 hover:underline"
          >
            Back to advanced search
          </Link>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-semibold">Candidates</h1>
              <p>
                Total: <span className="font-medium">{filteredSorted.length}</span> results{" "}
                {place ? `in ${place}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-white border border-zinc-200 rounded-2xl px-5 py-3">
                <Search className="w-5 h-5 text-gray-600 mr-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search worker or candidate"
                  className="bg-transparent outline-none flex-1 min-w-[220px]"
                />
              </div>
              <button className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 px-6 py-3 rounded-2xl transition">
                <Filter className="w-5 h-5" /> Filters
              </button>
              <button
                onClick={() => location.reload()}
                className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 px-6 py-3 rounded-2xl transition"
              >
                <RefreshCw className="w-5 h-5" /> Refresh
              </button>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden">
            {error ? (
              <div className="p-6 text-red-600">{error}</div>
            ) : loading ? (
              <div className="p-6">Loading…</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[1180px] w-full">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-gray-600 border-b border-zinc-100">
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-4 py-4 font-medium">Job Role</th>
                      <th className="px-4 py-4 font-medium">Location</th>
                      <th className="px-4 py-4 font-medium">Distance</th>
                      <th className="px-4 py-4 font-medium">Lat</th>
                      <th className="px-6 py-4 font-medium">Lng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSorted.map((w) => (
                      <tr key={w.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {w.first_name} {w.last_name}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{w.job_role}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {w.address1
                            ? w.address1
                            : w.address
                              ? w.address
                              : [w.city, w.state].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {typeof w.distance_meters === "number"
                            ? `${(w.distance_meters / 1609.344).toFixed(1)} mi`
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {w.lat?.toFixed?.(3) ?? w.lat}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {w.lng?.toFixed?.(3) ?? w.lng}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

