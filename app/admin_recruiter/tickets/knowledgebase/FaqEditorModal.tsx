"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { FaqListItem } from "@/lib/faqs/types";

const CATEGORY_SUGGESTIONS = [
  "General",
  "Billing",
  "Onboarding",
  "Documents",
  "Scheduling",
  "Payments",
  "Technical",
];

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: FaqListItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    category: string;
    question: string;
    answer: string;
    sortOrder: number;
    isPublished: boolean;
  }) => Promise<void> | void;
};

export function FaqEditorModal({
  open,
  mode,
  initial,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [category, setCategory] = useState("General");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCategory(initial?.category?.trim() || "General");
      setQuestion(initial?.question ?? "");
      setAnswer(initial?.answer ?? "");
      setSortOrder(initial?.sort_order ?? 0);
      setIsPublished(initial?.is_published !== false);
      setError(null);
      window.setTimeout(() => closeRef.current?.focus(), 0);
    }
    wasOpen.current = open;
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!question.trim()) {
      setError("Question is required.");
      return;
    }
    if (!answer.trim()) {
      setError("Answer is required.");
      return;
    }
    setError(null);
    await onSubmit({
      category: category.trim() || "General",
      question: question.trim(),
      answer: answer.trim(),
      sortOrder,
      isPublished,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-editor-title"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2
              id="faq-editor-title"
              className="text-lg font-semibold text-[color:var(--brand-secondary,#012352)]"
            >
              {mode === "create" ? "Add FAQ" : "Edit FAQ"}
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              FAQs appear in Help & Support and Knowledgebase for your tenant.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Category</span>
            <input
              list="faq-category-suggestions"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              placeholder="General"
              disabled={submitting}
            />
            <datalist id="faq-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Question</span>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              placeholder="How do I open a support ticket?"
              maxLength={300}
              disabled={submitting}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Answer</span>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="min-h-[140px] w-full resize-y rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              placeholder="Write a clear answer for staff and workers."
              maxLength={8000}
              disabled={submitting}
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#374151]">Sort order</span>
              <input
                type="number"
                min={0}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value) || 0)}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                disabled={submitting}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-[#374151]">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1]"
                disabled={submitting}
              />
              Published (visible in Help)
            </label>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 flex-1 rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 flex-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: "var(--brand-secondary, #012352)" }}
            >
              {submitting ? "Saving..." : mode === "create" ? "Create FAQ" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
