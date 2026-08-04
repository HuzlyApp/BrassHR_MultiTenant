"use client";

import { Check, Copy, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  JOB_FORM_SELECT_CHEVRON,
  JOB_FORM_SELECT_CLASS,
  JOB_FORM_SURFACE_CLASS,
} from "./job-form-shared";
import { JobDescriptionHtml } from "./JobDescriptionEditor";

const AI_TONE_OPTIONS = ["Professional", "Friendly", "Formal", "Conversational"] as const;

/** Preset focus chips (red-box extras removed — users can create those manually). */
const AI_FOCUS_AREA_OPTIONS = [
  "Patient Care",
  "Clinical Assessment",
  "Wound Care",
  "Critical Thinking",
  "Patient Education",
  "Team Collaboration",
] as const;

const MAX_FOCUS_AREAS = 5;

export type AiJobDescriptionContext = {
  jobTitle?: string;
  professionName?: string;
  specialtyName?: string;
  employmentType?: string;
  location?: string;
  locationType?: string;
  yearsOfExperience?: string;
  benefits?: string[];
  compensationType?: string;
  currency?: string;
  showPayBy?: string;
  payRatePeriod?: string;
  payRateMin?: number | null;
  payRateMax?: number | null;
  duration?: string;
  shiftType?: string;
  facility?: string;
  department?: string;
  requiredCredentials?: string;
  specialRequirements?: string;
  numberOfPositions?: number | null;
  applicationDeadline?: string;
};

export type AiJobDescriptionInsertPayload = {
  descriptionHtml: string;
  responsibilitiesHtml: string;
  qualificationsHtml: string;
  benefitsHtml: string;
};

function focusChipClass(selected: boolean) {
  return `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-[#1D2739] transition ${
    selected
      ? "border border-[color:var(--brand-secondary)] bg-white shadow-sm"
      : "border border-transparent bg-[#EEF2F6] hover:bg-[#E8EDF3]"
  }`;
}

/**
 * AI Description Generator — calls Grok (xAI) via /api/admin/jobs/generate-description.
 */
export default function AiJobDescriptionPanel({
  context,
  onInsert,
}: {
  context?: AiJobDescriptionContext;
  onInsert?: (payload: AiJobDescriptionInsertPayload) => void;
}) {
  const [roleAbout, setRoleAbout] = useState("");
  const [useJobPostFields, setUseJobPostFields] = useState(false);
  const [tone, setTone] = useState<string>("Professional");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [customFocusAreas, setCustomFocusAreas] = useState<string[]>([]);
  const [creatingFocus, setCreatingFocus] = useState(false);
  const [newFocusName, setNewFocusName] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [responsibilitiesHtml, setResponsibilitiesHtml] = useState("");
  const [qualificationsHtml, setQualificationsHtml] = useState("");
  const [benefitsHtml, setBenefitsHtml] = useState("");
  const [generating, setGenerating] = useState(false);

  const hasGenerated = Boolean(
    descriptionHtml.trim() ||
      responsibilitiesHtml.trim() ||
      qualificationsHtml.trim() ||
      benefitsHtml.trim()
  );

  const focusOptions = [
    ...AI_FOCUS_AREA_OPTIONS,
    ...customFocusAreas.filter(
      (item) => !(AI_FOCUS_AREA_OPTIONS as readonly string[]).includes(item)
    ),
  ];

  function toggleFocusArea(area: string) {
    setFocusAreas((prev) => {
      if (prev.includes(area)) return prev.filter((item) => item !== area);
      if (prev.length >= MAX_FOCUS_AREAS) {
        toast.error(`You can select up to ${MAX_FOCUS_AREAS} focus areas.`);
        return prev;
      }
      return [...prev, area];
    });
  }

  function addCustomFocusArea() {
    const name = newFocusName.trim();
    if (!name) return;

    const exists = focusOptions.some((item) => item.toLowerCase() === name.toLowerCase());
    if (exists) {
      const match =
        focusOptions.find((item) => item.toLowerCase() === name.toLowerCase()) ?? name;
      setFocusAreas((prev) => {
        if (prev.some((item) => item.toLowerCase() === match.toLowerCase())) return prev;
        if (prev.length >= MAX_FOCUS_AREAS) {
          toast.error(`You can select up to ${MAX_FOCUS_AREAS} focus areas.`);
          return prev;
        }
        return [...prev, match];
      });
      setNewFocusName("");
      setCreatingFocus(false);
      return;
    }

    setCustomFocusAreas((prev) => [...prev, name]);
    setFocusAreas((prev) => {
      if (prev.length >= MAX_FOCUS_AREAS) {
        toast.error(`You can select up to ${MAX_FOCUS_AREAS} focus areas.`);
        return prev;
      }
      return [...prev, name];
    });
    setNewFocusName("");
    setCreatingFocus(false);
  }

  function removeCustomFocusArea(area: string) {
    setCustomFocusAreas((prev) => prev.filter((item) => item !== area));
    setFocusAreas((prev) => prev.filter((item) => item !== area));
  }

  async function handleGenerate() {
    const hasFormAnchor =
      useJobPostFields &&
      Boolean(
        context?.jobTitle?.trim() ||
          context?.professionName?.trim() ||
          context?.specialtyName?.trim() ||
          context?.location?.trim()
      );

    if (roleAbout.trim().length < 12 && !hasFormAnchor) {
      toast.error(
        useJobPostFields
          ? "Fill more job fields on previous steps, or describe the primary role."
          : "Please describe the primary role in a short sentence first."
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/admin/jobs/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleAbout: roleAbout.trim(),
          tone,
          focusAreas,
          useJobPostFields,
          jobTitle: context?.jobTitle ?? "",
          professionName: context?.professionName ?? "",
          specialtyName: context?.specialtyName ?? "",
          employmentType: context?.employmentType ?? "",
          location: context?.location ?? "",
          locationType: context?.locationType ?? "",
          yearsOfExperience: context?.yearsOfExperience ?? "",
          benefits: context?.benefits ?? [],
          compensationType: context?.compensationType ?? "",
          currency: context?.currency ?? "",
          showPayBy: context?.showPayBy ?? "",
          payRatePeriod: context?.payRatePeriod ?? "",
          payRateMin: context?.payRateMin ?? null,
          payRateMax: context?.payRateMax ?? null,
          duration: context?.duration ?? "",
          shiftType: context?.shiftType ?? "",
          facility: context?.facility ?? "",
          department: context?.department ?? "",
          requiredCredentials: context?.requiredCredentials ?? "",
          specialRequirements: context?.specialRequirements ?? "",
          numberOfPositions: context?.numberOfPositions ?? null,
          applicationDeadline: context?.applicationDeadline ?? "",
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        descriptionHtml?: string;
        responsibilitiesHtml?: string;
        qualificationsHtml?: string;
        benefitsHtml?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to generate job description.");
      }

      setDescriptionHtml(payload.descriptionHtml?.trim() || "");
      setResponsibilitiesHtml(payload.responsibilitiesHtml?.trim() || "");
      setQualificationsHtml(payload.qualificationsHtml?.trim() || "");
      setBenefitsHtml(payload.benefitsHtml?.trim() || "");
      toast.success("Description generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate job description.");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyAll() {
    if (!hasGenerated) return;
    const plain = descriptionHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    void navigator.clipboard.writeText(plain).then(
      () => toast.success("Copied."),
      () => toast.error("Could not copy to clipboard.")
    );
  }

  function handleInsert() {
    if (!hasGenerated || !onInsert) return;
    onInsert({
      descriptionHtml,
      responsibilitiesHtml,
      qualificationsHtml,
      benefitsHtml,
    });
    toast.success("Inserted into the job form.");
  }

  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] px-5 py-3.5">
          <Sparkles
            className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          <h3 className="text-base font-semibold text-[color:var(--brand-primary)]">
            AI Description Generator
          </h3>
        </div>
        <div className="space-y-4 p-5">
        <p className="text-sm leading-5 text-[#64748B]">
          Let AI help you create a compelling job description based on the details you provide.
        </p>

        <div className="space-y-4">
          <div>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="ai-role-about">
              What is the primary role about?
            </label>
            <textarea
              id="ai-role-about"
              value={roleAbout}
              onChange={(event) => setRoleAbout(event.target.value)}
              rows={4}
              placeholder="Describe the core purpose of this role…"
              disabled={generating}
              className={`${JOB_FORM_SURFACE_CLASS} min-h-[100px] w-full resize-y px-3 py-3 outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-70`}
            />
          </div>

          <div>
            <label
              className={`mb-3 inline-flex cursor-pointer items-start gap-2.5 text-sm text-[#334155] ${
                generating ? "opacity-70" : ""
              }`}
            >
              <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
                <input
                  type="checkbox"
                  checked={useJobPostFields}
                  disabled={generating}
                  onChange={(event) => setUseJobPostFields(event.target.checked)}
                  className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-2 border-[#CBD5E1] bg-white transition-colors checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] disabled:cursor-not-allowed"
                />
                <Check
                  className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
                  strokeWidth={3}
                  aria-hidden
                />
              </span>
              <span className="min-w-0 leading-5">
                Generate as per job post filled fields
              </span>
            </label>
            <label className={JOB_FORM_LABEL_CLASS} htmlFor="ai-tone">
              Tone
            </label>
            <select
              id="ai-tone"
              className={JOB_FORM_SELECT_CLASS}
              style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
              value={tone}
              disabled={generating}
              onChange={(event) => setTone(event.target.value)}
            >
              {AI_TONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex flex-nowrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-normal text-[#64748B]">Focus Areas</p>
                <p className="text-sm font-normal text-[#64748B]">(Select up to 3–5)</p>
              </div>
              {!creatingFocus ? (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setCreatingFocus(true)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap pt-0.5 text-sm font-medium text-[color:var(--brand-secondary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Create Focus Area
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {focusOptions.map((area) => {
                const isSelected = focusAreas.includes(area);
                const isCustom = customFocusAreas.includes(area);

                if (isCustom) {
                  return (
                    <div key={area} className={`${focusChipClass(isSelected)} pl-3 pr-1.5`}>
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => toggleFocusArea(area)}
                        className="inline-flex cursor-pointer items-center gap-2 disabled:cursor-not-allowed"
                        aria-pressed={isSelected}
                      >
                        {isSelected ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                        ) : (
                          <Plus
                            className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                        )}
                        {area}
                      </button>
                      <button
                        type="button"
                        disabled={generating}
                        aria-label={`Remove ${area}`}
                        className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[color:var(--brand-secondary)] transition hover:bg-[#E8EDF3] disabled:cursor-not-allowed"
                        onClick={() => removeCustomFocusArea(area)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={area}
                    type="button"
                    disabled={generating}
                    onClick={() => toggleFocusArea(area)}
                    className={`${focusChipClass(isSelected)} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    ) : (
                      <Plus
                        className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    )}
                    {area}
                  </button>
                );
              })}
            </div>

            {creatingFocus ? (
              <div className="mt-3 flex w-full flex-col gap-2">
                <input
                  autoFocus
                  className={`${JOB_FORM_INPUT_CLASS} w-full`}
                  value={newFocusName}
                  disabled={generating}
                  onChange={(event) => setNewFocusName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomFocusArea();
                    }
                    if (event.key === "Escape") {
                      setCreatingFocus(false);
                      setNewFocusName("");
                    }
                  }}
                  placeholder="Enter focus area name"
                  aria-label="New focus area name"
                />
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={addCustomFocusArea}
                    disabled={generating}
                    className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} w-full`}
                    style={{
                      backgroundColor: "var(--brand-primary)",
                      borderColor: "var(--brand-primary)",
                    }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => {
                      setCreatingFocus(false);
                      setNewFocusName("");
                    }}
                    className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} w-full`}
            style={{
              backgroundColor: "var(--brand-primary)",
              borderColor: "var(--brand-primary)",
            }}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {generating ? "Generating…" : "Generate Description"}
          </button>
        </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] px-5 py-3.5">
          <h3 className="text-base font-semibold text-[color:var(--brand-primary)]">
            AI Generated Description
          </h3>
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={!hasGenerated || generating}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-[color:var(--brand-primary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy All
          </button>
        </div>

        <div className="space-y-4 p-5">
        <div
          className={`${JOB_FORM_INPUT_CLASS} h-[220px] max-h-[220px] overflow-y-auto py-3 text-[#64748B]`}
        >
          {hasGenerated ? (
            <div className="space-y-4">
              {descriptionHtml.trim() ? (
                <JobDescriptionHtml html={descriptionHtml} emptyLabel="" />
              ) : (
                <>
                  {responsibilitiesHtml.trim() ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Key Responsibilities
                      </p>
                      <JobDescriptionHtml html={responsibilitiesHtml} asList emptyLabel="" />
                    </div>
                  ) : null}
                  {qualificationsHtml.trim() ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Qualifications
                      </p>
                      <JobDescriptionHtml html={qualificationsHtml} asList emptyLabel="" />
                    </div>
                  ) : null}
                  {benefitsHtml.trim() ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Benefits
                      </p>
                      <JobDescriptionHtml html={benefitsHtml} asList emptyLabel="" />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm leading-5 text-[#94A3B8]">
              Generated About the Role, Key Responsibilities, Qualifications, and Benefits will
              appear here after you run Generate Description.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleInsert}
          disabled={!hasGenerated || !onInsert || generating}
          className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-4 text-sm font-medium text-[color:var(--brand-secondary)] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Insert to Job Description
        </button>
        </div>
      </section>
    </aside>
  );
}
