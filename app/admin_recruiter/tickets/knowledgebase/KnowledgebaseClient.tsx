"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";
import { FaqEditorModal } from "@/app/admin_recruiter/tickets/knowledgebase/FaqEditorModal";
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  function openEdit(faq: FaqListItem) {
    if (!faq.tenant_id) {
      toast.error("Platform FAQs are read-only. Create a tenant FAQ from Help & Support.");
      return;
    }
    setEditingFaq(faq);
    setEditorOpen(true);
  }

  async function handleSubmit(input: {
    category: string;
    question: string;
    answer: string;
    sortOrder: number;
    isPublished: boolean;
  }) {
    if (!editingFaq) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/faqs/${encodeURIComponent(editingFaq.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        faq?: FaqListItem;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not save FAQ.");
      toast.success("FAQ updated");
      setEditorOpen(false);
      setEditingFaq(null);
      await loadFaqs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save FAQ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(faq: FaqListItem) {
    if (!faq.tenant_id) {
      toast.error("Platform FAQs cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(`Delete FAQ “${faq.question}”?`);
    if (!confirmed) return;
    setDeletingId(faq.id);
    try {
      const res = await fetch(`/api/admin/faqs/${encodeURIComponent(faq.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not delete FAQ.");
      toast.success("FAQ deleted");
      await loadFaqs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete FAQ.");
    } finally {
      setDeletingId(null);
    }
  }

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
          Review and edit FAQ articles shown in Help & Support.
        </p>
      </div>

      <TicketsSubNav />

      <div className="px-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4">
          <label className="relative block max-w-md">
            <span className="sr-only">Search FAQs</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search FAQs by question, answer, or category..."
              className="h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[color:var(--brand-secondary,#012352)] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]"
            />
          </label>
        </div>

        {loading ? (
          <DashboardPageLoader label="Loading knowledgebase..." className="min-h-[420px]" />
        ) : filteredFaqs.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-12 text-center">
            <p className="text-base font-semibold text-[color:var(--brand-secondary,#012352)]">
              No FAQs yet
            </p>
            <p className="mt-2 max-w-md text-sm text-[#6B7280]">
              Add FAQs from Help & Support, then edit them here.
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
              const deleting = deletingId === faq.id;
              return (
                <article
                  key={faq.id}
                  className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
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

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(faq)}
                        disabled={isPlatform || deleting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-sm font-medium text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(faq)}
                        disabled={isPlatform || deleting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FECDCA] px-3 text-sm font-medium text-[#B42318] transition hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <FaqEditorModal
        open={editorOpen}
        mode="edit"
        initial={editingFaq}
        submitting={submitting}
        onClose={() => {
          if (submitting) return;
          setEditorOpen(false);
          setEditingFaq(null);
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
