"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import type { FaqListItem } from "@/lib/faqs/types";

const ALL_CATEGORIES = "__all__";
const PAGE_SIZE = 10;

function formatCategory(value: string): string {
  const text = value.trim();
  if (!text) return "General";
  return text;
}

function answerPreview(answer: string, maxLength = 120): string {
  const text = answer.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

function SidebarFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition ${
        active
          ? "border-[#E5E7EB] bg-[#F4F4F4] text-[color:var(--brand-primary)]"
          : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#FAFBFC]"
      }`}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="flex items-center gap-1.5 text-[#94A3B8]">
        {typeof count === "number" ? (
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#64748B]">
            {count}
          </span>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  );
}

function FaqRowItem({
  faq,
  expanded,
  onToggle,
}: {
  faq: FaqListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isPlatform = faq.tenant_id == null;

  return (
    <div className="border-b border-[#F1F5F9] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[#FAFBFC]"
      >
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8] transition ${expanded ? "rotate-0" : "-rotate-90"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#0F172A]">{faq.question}</span>
            {isPlatform ? (
              <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                Platform
              </span>
            ) : null}
          </span>
          {!expanded ? (
            <span className="mt-1 block text-xs text-[#64748B]">{answerPreview(faq.answer)}</span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-[#F8FAFC] bg-[#FAFBFC] px-4 py-4 pl-11">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#334155]">{faq.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function KnowledgebaseClient() {
  const [faqs, setFaqs] = useState<FaqListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faqs", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as {
        faqs?: FaqListItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load knowledgebase articles.");
      setFaqs(payload.faqs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load knowledgebase articles.");
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFaqs();
  }, [loadFaqs]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const faq of faqs) {
      const category = formatCategory(faq.category);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return faqs.filter((faq) => {
      const category = formatCategory(faq.category);
      if (categoryFilter !== ALL_CATEGORIES && category !== categoryFilter) return false;
      if (!query) return true;
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
    });
  }, [categoryFilter, faqs, searchQuery]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFaqs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFaqs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredFaqs.slice(start, start + PAGE_SIZE);
  }, [filteredFaqs, safePage]);

  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Knowledgebase
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Help articles used by the applicant AI assistant
        </p>
      </div>

      <TicketsSubNav />

      <div className="px-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {loading ? (
            <DashboardPageLoader label="Loading knowledgebase..." className="min-h-[480px]" />
          ) : (
            <div className="grid min-h-[520px] lg:grid-cols-[290px_minmax(0,1fr)]">
              <aside className="border-b border-[#E5E7EB] p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  <SidebarFilterButton
                    label="All categories"
                    count={faqs.length}
                    active={categoryFilter === ALL_CATEGORIES}
                    onClick={() => setCategoryFilter(ALL_CATEGORIES)}
                  />
                  {categories.map((category) => (
                    <SidebarFilterButton
                      key={category.name}
                      label={category.name}
                      count={category.count}
                      active={categoryFilter === category.name}
                      onClick={() => setCategoryFilter(category.name)}
                    />
                  ))}
                </div>
              </aside>

              <section className="min-w-0">
                <div className="border-b border-[#E5E7EB] px-4 py-3">
                  <label className="relative block">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search questions and answers..."
                      className="w-full rounded-lg border border-[#E2E8F0] py-2.5 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-primary)]"
                    />
                  </label>
                </div>

                {filteredFaqs.length === 0 ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
                    <p className="text-base font-medium text-[#0F172A]">No articles found</p>
                    <p className="mt-2 max-w-md text-sm text-[#64748B]">
                      {faqs.length === 0
                        ? "No FAQ articles are configured yet."
                        : "Try a different category or search term."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      {paginatedFaqs.map((faq) => (
                        <FaqRowItem
                          key={faq.id}
                          faq={faq}
                          expanded={expandedId === faq.id}
                          onToggle={() =>
                            setExpandedId((current) => (current === faq.id ? null : faq.id))
                          }
                        />
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3 text-sm text-[#64748B]">
                      <p>
                        Showing {(safePage - 1) * PAGE_SIZE + 1}–
                        {Math.min(safePage * PAGE_SIZE, filteredFaqs.length)} of {filteredFaqs.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span>
                          Page {safePage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
