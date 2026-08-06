"use client";

import { Info, Loader2, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
} from "./job-form-shared";
import { JobDescriptionEditor, jobDescriptionPlainText } from "./JobDescriptionEditor";

export type JobDescriptionSuggestPayload = {
  jobTitle?: string | null;
  profession?: string | null;
  specialty?: string | null;
  employmentType?: string | null;
  location?: string | null;
  locationType?: string | null;
  yearsOfExperience?: string | null;
  educationRequirements?: string | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  numberOfPositions?: number | null;
  shiftOrSchedule?: string | null;
  benefits?: string[];
  responsibilities?: string | null;
  qualifications?: string | null;
  companyName?: string | null;
  department?: string | null;
  facility?: string | null;
  duration?: string | null;
  requiredCredentials?: string | null;
  specialRequirements?: string | null;
  additionalLocations?: string[];
};

type PendingMode = "replace" | "insert" | null;
type PostGenMode = "idle" | "review";

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  buildPayload: () => JobDescriptionSuggestPayload;
  brandStyle?: CSSProperties;
};

const GENERATE_ERROR =
  "We couldn’t generate a description right now. You can try again or enter it manually.";

const AI_DESCRIPTION_HELP_MESSAGE =
  "Suggest with AI writes a draft from your job title, profession, specialty, location, and other details you already entered. Review and edit the text before publishing — AI suggestions are a starting point, not a final post.";

function hasRequiredSuggestInput(payload: JobDescriptionSuggestPayload): boolean {
  return Boolean(
    payload.jobTitle?.trim() ||
      payload.profession?.trim() ||
      payload.specialty?.trim()
  );
}

function appendDescription(existing: string, generated: string): string {
  const current = existing.trim();
  if (!current) return generated;
  return `${current}\n${generated}`;
}

function AiDescriptionHelpButton({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 280;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    setPosition({ top: rect.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#64748B] transition hover:text-[#475569]"
        aria-label="About AI job description"
        aria-expanded={open}
        aria-describedby={open ? "ai-description-help-popover" : undefined}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id="ai-description-help-popover"
              role="tooltip"
              style={{ position: "fixed", top: position.top, left: position.left, zIndex: 200 }}
              className="w-[280px] rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-left text-xs leading-5 text-[#475569] shadow-lg"
            >
              {message}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function JobDescriptionWithAiSuggest({
  value,
  onChange,
  error,
  buildPayload,
  brandStyle,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"idle" | "choose">("idle");
  const [postGen, setPostGen] = useState<PostGenMode>("idle");
  const [pendingHtml, setPendingHtml] = useState<string | null>(null);
  const previousHtmlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const canSuggest = hasRequiredSuggestInput(buildPayload());

  async function runGenerate(applyMode: PendingMode) {
    if (generating) {
      abortRef.current?.abort();
    }

    const payload = buildPayload();
    if (!hasRequiredSuggestInput(payload)) {
      toast.error("Add a job title, profession, or specialty first.");
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setConfirmMode("idle");
    setPostGen("idle");

    try {
      const response = await fetch("/api/admin/jobs/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      const data = (await response.json().catch(() => ({}))) as {
        descriptionHtml?: string;
        error?: string;
        warnings?: string[];
      };

      if (!response.ok || !data.descriptionHtml?.trim()) {
        toast.error(data.error || GENERATE_ERROR);
        return;
      }

      previousHtmlRef.current = value;
      const next =
        applyMode === "insert"
          ? appendDescription(value, data.descriptionHtml)
          : data.descriptionHtml;

      onChange(next);
      setPendingHtml(data.descriptionHtml);
      setPostGen("review");

      if (data.warnings?.length) {
        toast(data.warnings[0], { icon: "ℹ️" });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId !== requestIdRef.current) return;
      toast.error(GENERATE_ERROR);
    } finally {
      if (requestId === requestIdRef.current) {
        setGenerating(false);
      }
    }
  }

  function handleSuggestClick() {
    if (!canSuggest || generating) return;
    if (jobDescriptionPlainText(value).trim()) {
      setConfirmMode("choose");
      return;
    }
    void runGenerate("replace");
  }

  function handleUndo() {
    if (previousHtmlRef.current != null) {
      onChange(previousHtmlRef.current);
    }
    previousHtmlRef.current = null;
    setPendingHtml(null);
    setPostGen("idle");
  }

  function handleKeep() {
    previousHtmlRef.current = null;
    setPendingHtml(null);
    setPostGen("idle");
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={JOB_FORM_LABEL_CLASS} htmlFor="job-description-editor">
          Job description <span className="text-[#EF4444]">*</span>
        </label>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm leading-5 text-[#64748B]">
          <span>This is an AI powered job description. You can edit or replace it.</span>
          <AiDescriptionHelpButton message={AI_DESCRIPTION_HELP_MESSAGE} />
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#F8E7C8)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,#FFFBF5)] px-4 py-3 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between min-[700px]:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--brand-primary)] shadow-sm"
            aria-hidden
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1D2739]">Improve your job description</p>
            <p className="mt-0.5 text-sm leading-5 text-[#64748B]">
              Add more details like skills and credentials, and we&apos;ll rewrite your job
              description.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSuggestClick}
          disabled={!canSuggest || generating}
          className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} shrink-0 border-[color:color-mix(in_srgb,var(--brand-primary)_40%,#E5E7EB)] bg-white text-[#1D2739]`}
          title={
            canSuggest
              ? "Generate a suggested description from the job details"
              : "Enter a job title, profession, or specialty first"
          }
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden />
          )}
          {generating ? "Generating…" : "Suggest with AI"}
        </button>
      </div>

      {confirmMode === "choose" ? (
        <div
          role="dialog"
          aria-label="Apply generated description"
          className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-sm text-[#334155]"
        >
          <p className="mb-3">
            The editor already has a description. How should we apply the AI suggestion?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={JOB_FORM_PRIMARY_BUTTON_CLASS}
              style={brandStyle}
              disabled={generating}
              onClick={() => void runGenerate("replace")}
            >
              Replace existing description
            </button>
            <button
              type="button"
              className={JOB_FORM_OUTLINE_BUTTON_CLASS}
              disabled={generating}
              onClick={() => void runGenerate("insert")}
            >
              Insert below existing description
            </button>
            <button
              type="button"
              className={JOB_FORM_OUTLINE_BUTTON_CLASS}
              disabled={generating}
              onClick={() => setConfirmMode("idle")}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative" id="job-description-editor">
        {generating ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="inline-flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#64748B] shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Generating description…
            </span>
          </div>
        ) : null}
        <JobDescriptionEditor value={value} onChange={onChange} error={error} />
      </div>

      {postGen === "review" && pendingHtml ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={JOB_FORM_OUTLINE_BUTTON_CLASS}
            disabled={generating}
            onClick={() => void runGenerate("replace")}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Regenerate
          </button>
          <button
            type="button"
            className={JOB_FORM_OUTLINE_BUTTON_CLASS}
            disabled={generating || previousHtmlRef.current == null}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className={JOB_FORM_PRIMARY_BUTTON_CLASS}
            style={brandStyle}
            disabled={generating}
            onClick={handleKeep}
          >
            Keep description
          </button>
        </div>
      ) : null}
    </div>
  );
}
