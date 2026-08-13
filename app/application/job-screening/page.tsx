"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { brandingToCssVars, hexToRgba } from "@/lib/tenant/tenant-branding";
import { currentOnboardingTenantSlug } from "@/lib/tenant/with-tenant";
import type { JobScreeningQuestionType } from "@/lib/jobs/screening-questions";

type ScreeningQuestion = {
  id: string;
  question: string;
  questionType: JobScreeningQuestionType;
  options: Array<{ label: string; value: string }> | null;
  isRequired: boolean;
  answer: unknown;
};

export default function JobScreeningPage() {
  const branding = useTenantBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug =
    searchParams.get("tenant")?.trim().toLowerCase() ||
    branding.slug?.trim().toLowerCase() ||
    currentOnboardingTenantSlug();
  const jobToken =
    searchParams.get("job_token")?.trim() ||
    (typeof window !== "undefined" ? localStorage.getItem("applicationJobToken")?.trim() : "") ||
    "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const shellStyle = useMemo(
    () => ({
      ...brandingToCssVars(branding),
      backgroundColor: hexToRgba(branding.primaryHex, 0.04),
    }),
    [branding]
  );

  useEffect(() => {
    const applicantId =
      typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() : "";
    if (!applicantId || !jobToken || !tenantSlug) {
      setLoading(false);
      setError("Missing application context. Return to the job listing and apply again.");
      return;
    }

    void fetch(
      `/api/onboarding/job-screening-answers?applicantId=${encodeURIComponent(applicantId)}&jobToken=${encodeURIComponent(jobToken)}&tenantSlug=${encodeURIComponent(tenantSlug)}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load screening questions");
        }
        if (!payload.hasQuestions) {
          router.replace(applicationPath(APPLICATION_ROUTES.addResume, tenantSlug));
          return;
        }
        const loaded = (payload.questions ?? []) as ScreeningQuestion[];
        const allRequiredAnswered = loaded.every(
          (item) => !item.isRequired || (item.answer != null && String(item.answer).trim() !== "")
        );
        if (allRequiredAnswered && loaded.length > 0 && loaded.every((item) => item.answer != null)) {
          router.replace(applicationPath(APPLICATION_ROUTES.addResume, tenantSlug));
          return;
        }
        setQuestions(loaded);
        setAnswers(
          Object.fromEntries(
            loaded.map((item) => [item.id, item.answer ?? defaultAnswer(item.questionType)])
          )
        );
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load screening questions");
      })
      .finally(() => setLoading(false));
  }, [jobToken, router, tenantSlug]);

  function defaultAnswer(questionType: JobScreeningQuestionType): unknown {
    if (questionType === "multiple_select") return [];
    if (questionType === "yes_no") return null;
    return "";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const applicantId = localStorage.getItem("applicantId")?.trim();
    if (!applicantId || !jobToken || !tenantSlug) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/job-screening-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          tenantSlug,
          jobToken,
          answers: questions.map((item) => ({
            questionId: item.id,
            answer: answers[item.id],
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save screening answers");
      }
      router.push(applicationPath(APPLICATION_ROUTES.addResume, tenantSlug));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save screening answers");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={shellStyle}>
        <OnboardingLoader label="Loading screening questions…" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10" style={shellStyle}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Screening Questions</h1>
        <p className="mt-2 text-sm text-slate-600">
          Answer these job-specific questions before continuing your application.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
          {questions.map((item) => (
            <fieldset key={item.id} className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">
                {item.question}
                {item.isRequired ? <span className="text-rose-600"> *</span> : null}
              </legend>

              {item.questionType === "yes_no" ? (
                <div className="flex gap-4">
                  {["Yes", "No"].map((label) => (
                    <label key={label} className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={item.id}
                        checked={
                          label === "Yes"
                            ? answers[item.id] === true || answers[item.id] === "yes"
                            : answers[item.id] === false || answers[item.id] === "no"
                        }
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [item.id]: label === "Yes",
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : null}

              {item.questionType === "number" ? (
                <input
                  type="number"
                  value={String(answers[item.id] ?? "")}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}

              {item.questionType === "short_text" || item.questionType === "long_text" ? (
                <textarea
                  rows={item.questionType === "long_text" ? 4 : 2}
                  value={String(answers[item.id] ?? "")}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : null}

              {item.questionType === "single_select" ? (
                <select
                  value={String(answers[item.id] ?? "")}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select an option</option>
                  {(item.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {item.questionType === "multiple_select" ? (
                <div className="space-y-2">
                  {(item.options ?? []).map((option) => {
                    const selected = Array.isArray(answers[item.id])
                      ? (answers[item.id] as string[])
                      : [];
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(option.value)}
                          onChange={(event) => {
                            setAnswers((current) => {
                              const currentValues = Array.isArray(current[item.id])
                                ? [...(current[item.id] as string[])]
                                : [];
                              const nextValues = event.target.checked
                                ? [...currentValues, option.value]
                                : currentValues.filter((value) => value !== option.value);
                              return { ...current, [item.id]: nextValues };
                            });
                          }}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>
          ))}

          <button
            type="submit"
            disabled={submitting || questions.length === 0}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: branding.primaryHex }}
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
