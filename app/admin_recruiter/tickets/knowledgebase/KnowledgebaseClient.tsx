"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import {
  BRAND_FONT_BODY_STYLE,
  BRAND_FONT_HEADING_STYLE,
} from "@/lib/tenant/branding-typography-styles";
import type { FaqListItem } from "@/lib/faqs/types";

function formatCategory(value: string): string {
  const text = value.trim();
  return text || "General";
}

export default function KnowledgebaseClient() {
  const [faqs, setFaqs] = useState<FaqListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faqs?manage=1", {
        cache: "no-store",
        credentials: "include",
      });
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

  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return faqs;
    return faqs.filter((faq) => {
      const haystack = `${faq.category} ${faq.question} ${faq.answer}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [faqs, search]);

  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1
          className="m-0 text-2xl font-semibold leading-8 tracking-normal text-[color:var(--brand-secondary,#012352)]"
          style={BRAND_FONT_HEADING_STYLE}
        >
          Knowledgebase
        </h1>
        <p
          className="m-0 mt-0.5 text-xs font-normal leading-4 tracking-normal text-[#6B7280]"
          style={BRAND_FONT_BODY_STYLE}
        >
          Browse FAQ articles. Add, edit, or delete them from Help & Support.
        </p>
      </div>

      <TicketsSubNav />

      <div className="px-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="relative block w-full max-w-md">
            <span className="sr-only">Search FAQs</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search FAQs by question, answer, or category..."
              className="h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[color:var(--brand-secondary,#012352)] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]"
            />
          </label>
          <Link
            href="/admin_recruiter/help-support"
            className="text-sm font-semibold text-[color:var(--brand-secondary,#012352)] underline-offset-2 hover:underline"
          >
            Manage in Help & Support
          </Link>
        </div>

        {loading ? (
          <DashboardPageLoader label="Loading knowledgebase..." className="min-h-[420px]" />
        ) : filteredFaqs.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-12 text-center">
            <p className="text-base font-semibold text-[color:var(--brand-secondary,#012352)]">
              No FAQs yet
            </p>
            <p className="mt-2 max-w-md text-sm text-[#6B7280]">
              Add and manage FAQs from Help & Support.
            </p>
            <Link
              href="/admin_recruiter/help-support"
              className="mt-4 text-sm font-semibold text-[color:var(--brand-secondary,#012352)] underline-offset-2 hover:underline"
            >
              Go to Help & Support
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isPlatform = !faq.tenant_id;
              return (
                <article
                  key={faq.id}
                  className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4B5563]">
                        {formatCategory(faq.category)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          faq.is_published
                            ? "bg-[rgba(22,163,74,0.12)] text-[#16A34A]"
                            : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}
                      >
                        {faq.is_published ? "Published" : "Draft"}
                      </span>
                      {isPlatform ? (
                        <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                          Platform
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-base font-semibold leading-6 text-[color:var(--brand-secondary,#012352)]">
                      {faq.question}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">{faq.answer}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
