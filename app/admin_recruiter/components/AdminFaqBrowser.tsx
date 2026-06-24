"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
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
          ? "border-[#E2E8F0] bg-[#F4F4F4] text-[color:var(--brand-primary)]"
          : "border-[#E2E8F0] bg-white text-[#374151] hover:bg-[#FAFBFC]"
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

function FaqSidebarRowItem({
  faq,
  expanded,
  onToggle,
}: {
  faq: FaqListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isPlatform = faq.tenant_id == null;
  const categoryLabel = formatCategory(faq.category);

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
            <span className="text-sm font-medium text-[color:var(--brand-primary)]">{faq.question}</span>
            <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
              {isPlatform ? "Platform" : categoryLabel}
            </span>
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

function FaqCardItem({
  faq,
  expanded,
  onToggle,
}: {
  faq: FaqListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#FAFBFC]"
      >
        <span className="min-w-0 flex-1">
          <span
            className="block text-base font-semibold leading-6 text-[#1d2739]"
            style={CANDIDATES_PAGE_TITLE_STYLE}
          >
            {faq.question}
          </span>
          {!expanded ? (
            <span
              className="mt-1 block text-sm font-normal leading-5 text-[#718096]"
              style={CANDIDATES_PAGE_SUBTITLE_STYLE}
            >
              {answerPreview(faq.answer)}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className={`h-5 w-5 shrink-0 text-[#94A3B8] transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="border-t border-[#F1F5F9] px-5 pb-4 pt-3">
          <p
            className="whitespace-pre-wrap text-sm font-normal leading-6 text-[#475569]"
            style={CANDIDATES_PAGE_SUBTITLE_STYLE}
          >
            {faq.answer}
          </p>
        </div>
      ) : null}
    </div>
  );
}

type AdminFaqBrowserProps = {
  className?: string;
  variant?: "cards" | "sidebar";
  sectionTitle?: string;
  loadingLabel?: string;
  emptyConfiguredMessage?: string;
};

export default function AdminFaqBrowser({
  className,
  variant = "sidebar",
  sectionTitle = "Frequently Asked Questions",
  loadingLabel = "Loading FAQs...",
  emptyConfiguredMessage = "No FAQ articles are configured yet.",
}: AdminFaqBrowserProps) {
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
      if (!res.ok) throw new Error(payload.error || "Could not load FAQs.");
      setFaqs(payload.faqs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load FAQs.");
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
      if (variant === "sidebar" && categoryFilter !== ALL_CATEGORIES && category !== categoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
    });
  }, [categoryFilter, faqs, searchQuery, variant]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    setExpandedId(null);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(filteredFaqs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFaqs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredFaqs.slice(start, start + PAGE_SIZE);
  }, [filteredFaqs, safePage]);

  const emptyState = (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-base font-semibold text-[#1d2739]" style={CANDIDATES_PAGE_TITLE_STYLE}>
        No articles found
      </p>
      <p className="mt-2 max-w-md text-sm text-[#718096]" style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
        {faqs.length === 0 ? emptyConfiguredMessage : "Try a different search term."}
      </p>
    </div>
  );

  const paginationBarClass =
    variant === "cards"
      ? "mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4 text-sm text-[#64748B]"
      : "flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] px-4 py-3 text-sm text-[#64748B]";

  const paginationBar =
    filteredFaqs.length > 0 ? (
      <div className={paginationBarClass}>
        <p>
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredFaqs.length)} of{" "}
          {filteredFaqs.length}
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
    ) : null;

  if (variant === "cards") {
    return (
      <div className={className}>
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <DashboardPageLoader label={loadingLabel} className="min-h-[320px]" />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2
                className="text-xl font-semibold leading-7 text-[#1d2739]"
                style={CANDIDATES_PAGE_TITLE_STYLE}
              >
                {sectionTitle}
              </h2>
              <label className="relative w-full max-w-[320px] sm:w-[320px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search questions..."
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1d2739] placeholder:text-[#94A3B8] focus:border-(--brand-primary) focus:outline-none focus:ring-1 focus:ring-(--brand-primary)"
                  style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                />
              </label>
            </div>

            {filteredFaqs.length === 0 ? (
              emptyState
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedFaqs.map((faq) => (
                    <FaqCardItem
                      key={faq.id}
                      faq={faq}
                      expanded={expandedId === faq.id}
                      onToggle={() => setExpandedId((current) => (current === faq.id ? null : faq.id))}
                    />
                  ))}
                </div>
                {paginationBar}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        {loading ? (
          <DashboardPageLoader label={loadingLabel} className="min-h-[480px]" />
        ) : (
          <div className="grid min-h-[520px] lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="border-b border-[#E2E8F0] p-5 lg:border-b-0 lg:border-r">
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
              <div className="border-b border-[#E2E8F0] px-4 py-3">
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
                    className="w-full rounded-lg border border-[#E2E8F0] py-2.5 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-(--brand-primary) focus:outline-none focus:ring-1 focus:ring-(--brand-primary)"
                  />
                </label>
              </div>

              {filteredFaqs.length === 0 ? (
                emptyState
              ) : (
                <>
                  <div>
                    {paginatedFaqs.map((faq) => (
                      <FaqSidebarRowItem
                        key={faq.id}
                        faq={faq}
                        expanded={expandedId === faq.id}
                        onToggle={() => setExpandedId((current) => (current === faq.id ? null : faq.id))}
                      />
                    ))}
                  </div>

                  {paginationBar}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
