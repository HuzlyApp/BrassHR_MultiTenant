"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#1D2739]">Job Description</h2>
        <button
          type="button"
          onClick={handleSuggestClick}
          disabled={!canSuggest || generating}
          className={JOB_FORM_OUTLINE_BUTTON_CLASS}
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

      <div className="relative">
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
