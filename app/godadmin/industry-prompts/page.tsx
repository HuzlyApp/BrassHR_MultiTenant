"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Layers3, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  configStatusLabel,
  type IndustryPromptConfigStatus,
  type IndustryPromptListItem,
} from "@/lib/godadmin/industry-prompts";
import { EASTERN_TIME_LABEL, formatEastern } from "@/lib/datetime/eastern";
import EasternLiveClock from "@/app/components/godadmin/EasternLiveClock";

function StatusBadge({ status }: { status: IndustryPromptConfigStatus }) {
  const styles: Record<IndustryPromptConfigStatus, string> = {
    dedicated: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    partial: "bg-amber-50 text-amber-900 ring-amber-200",
    fallback_global: "bg-sky-50 text-sky-900 ring-sky-200",
    missing: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {configStatusLabel(status)}
    </span>
  );
}

function formatPromptTime(value: string | null | undefined): string {
  return formatEastern(
    value,
    { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    "—"
  );
}

export default function IndustryPromptsPage() {
  const [industries, setIndustries] = useState<IndustryPromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IndustryPromptConfigStatus>("all");

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/godadmin/industry-prompts", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIndustries([]);
        setError(payload.error || `Failed to load (${res.status})`);
        return;
      }
      setIndustries(payload.industries ?? []);
    } catch {
      setError("Network error while loading industry prompts.");
      setIndustries([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return industries.filter((row) => {
      if (statusFilter !== "all" && row.configStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        row.label.toLowerCase().includes(q) ||
        row.industryKey.toLowerCase().includes(q) ||
        row.aiPackLabel.toLowerCase().includes(q) ||
        row.aiPackKey.toLowerCase().includes(q)
      );
    });
  }, [industries, search, statusFilter]);

  const stats = useMemo(() => {
    const dedicated = industries.filter((row) => row.configStatus === "dedicated").length;
    const partial = industries.filter((row) => row.configStatus === "partial").length;
    const fallback = industries.filter((row) => row.configStatus === "fallback_global").length;
    const missing = industries.filter((row) => row.configStatus === "missing").length;
    return { dedicated, partial, fallback, missing };
  }, [industries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">God Admin</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Industry Prompts</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Manage Candidate–Job Analyzer prompts by industry pack. Edits publish immutable versions
            used on the next new analysis. Times shown in {EASTERN_TIME_LABEL}.
          </p>
        </div>
        <EasternLiveClock />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Dedicated", value: stats.dedicated, icon: CheckCircle2, tone: "text-emerald-700" },
          { label: "Partial", value: stats.partial, icon: Layers3, tone: "text-amber-700" },
          { label: "Global fallback", value: stats.fallback, icon: CircleDashed, tone: "text-sky-700" },
          { label: "Missing", value: stats.missing, icon: CircleDashed, tone: "text-slate-600" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-100"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-100">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search industries or packs…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-teal-600/20 placeholder:text-slate-400 focus:bg-white focus:ring-2"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | IndustryPromptConfigStatus)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
          >
            <option value="all">All statuses</option>
            <option value="dedicated">Dedicated</option>
            <option value="partial">Partial</option>
            <option value="fallback_global">Global fallback</option>
            <option value="missing">Not configured</option>
          </select>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">Loading industries…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Industry</th>
                  <th className="px-5 py-3 font-medium">AI pack</th>
                  <th className="px-5 py-3 font-medium">Prompt status</th>
                  <th className="px-5 py-3 font-medium">Steps configured</th>
                  <th className="px-5 py-3 font-medium">Active</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.industryKey} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">{row.label}</p>
                      <p className="font-mono text-xs text-slate-500">{row.industryKey}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-slate-800">{row.aiPackLabel}</p>
                      {row.sharesPackWith.length ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Shared with {row.sharesPackWith.map((peer) => peer.label).join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={row.configStatus} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {row.configuredVariantCount}/{row.totalVariantCount}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {row.activeVersionSummary
                        ? row.activeVersionSummary.replace(
                            /activated (.+)$/,
                            (_m, iso: string) => `activated ${formatPromptTime(iso)}`
                          )
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/godadmin/industry-prompts/${row.industryKey}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                      No industries match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
