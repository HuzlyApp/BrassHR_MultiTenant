"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { FaqListItem } from "@/lib/faqs/types";
import {
  type FaqFieldErrors,
  validateFaqFields,
} from "@/lib/faqs/faq-validation";

const CATEGORY_SUGGESTIONS = [
  "General",
  "Billing",
  "Onboarding",
  "Documents",
  "Scheduling",
  "Payments",
  "Technical",
];

const FIELD_ERROR_CLASS = "mt-1 text-xs font-medium text-[#B42318]";
const INPUT_BASE_CLASS =
  "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]";
const TEXTAREA_BASE_CLASS =
  "min-h-[140px] w-full resize-y rounded-lg border bg-white px-3.5 py-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]";

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

function fieldBorderClass(hasError: boolean): string {
  return hasError ? "border-[#F04438]" : "border-[#CBD5E1]";
}

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
  const [sortOrderText, setSortOrderText] = useState("0");
  const [isPublished, setIsPublished] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FaqFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setCategory(initial?.category?.trim() || "General");
      setQuestion(initial?.question ?? "");
      setAnswer(initial?.answer ?? "");
      setSortOrderText(String(initial?.sort_order ?? 0));
      setIsPublished(initial?.is_published !== false);
      setFieldErrors({});
      setError(null);
      setAttempted(false);
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

  function clearFieldError(field: keyof FaqFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setAttempted(true);
    const nextErrors = validateFaqFields({ category, question, answer });
    setFieldErrors(nextErrors);
    if (nextErrors.category || nextErrors.question || nextErrors.answer) {
      setError(null);
      return;
    }
    setError(null);
    const parsedSort = Number.parseInt(sortOrderText, 10);
    await onSubmit({
      category: category.trim(),
      question: question.trim(),
      answer: answer.trim(),
      sortOrder: Number.isFinite(parsedSort) && parsedSort >= 0 ? parsedSort : 0,
      isPublished,
    });
  }

  function handleSortOrderChange(raw: string) {
    if (raw === "") {
      setSortOrderText("");
      return;
    }
    if (!/^\d+$/.test(raw)) return;
    // Drop leading zeros while typing (e.g. "05" → "5") so default 0 is replaced.
    setSortOrderText(String(Number(raw)));
  }

  const showCategoryError = attempted && Boolean(fieldErrors.category);
  const showQuestionError = attempted && Boolean(fieldErrors.question);
  const showAnswerError = attempted && Boolean(fieldErrors.answer);

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

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4" noValidate>
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
              onChange={(event) => {
                setCategory(event.target.value);
                clearFieldError("category");
              }}
              className={`${INPUT_BASE_CLASS} ${fieldBorderClass(showCategoryError)}`}
              placeholder="General"
              disabled={submitting}
              aria-invalid={showCategoryError}
              aria-describedby={showCategoryError ? "faq-category-error" : undefined}
            />
            <datalist id="faq-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {showCategoryError ? (
              <p id="faq-category-error" className={FIELD_ERROR_CLASS} role="alert">
                {fieldErrors.category}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Question</span>
            <input
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                clearFieldError("question");
              }}
              className={`${INPUT_BASE_CLASS} ${fieldBorderClass(showQuestionError)}`}
              placeholder="How do I open a support ticket?"
              maxLength={300}
              disabled={submitting}
              aria-invalid={showQuestionError}
              aria-describedby={showQuestionError ? "faq-question-error" : undefined}
            />
            {showQuestionError ? (
              <p id="faq-question-error" className={FIELD_ERROR_CLASS} role="alert">
                {fieldErrors.question}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Answer</span>
            <textarea
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                clearFieldError("answer");
              }}
              className={`${TEXTAREA_BASE_CLASS} ${fieldBorderClass(showAnswerError)}`}
              placeholder="Write a clear answer for staff and workers."
              maxLength={8000}
              disabled={submitting}
              aria-invalid={showAnswerError}
              aria-describedby={showAnswerError ? "faq-answer-error" : undefined}
            />
            {showAnswerError ? (
              <p id="faq-answer-error" className={FIELD_ERROR_CLASS} role="alert">
                {fieldErrors.answer}
              </p>
            ) : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[#374151]">Sort order</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={sortOrderText}
                onChange={(event) => handleSortOrderChange(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                className={`${INPUT_BASE_CLASS} border-[#CBD5E1]`}
                disabled={submitting}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-[#374151]">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded-[4px] border-[#CBD5E1] accent-[color:var(--brand-secondary,#012352)]"
                style={{ accentColor: "var(--brand-secondary, #012352)" }}
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
