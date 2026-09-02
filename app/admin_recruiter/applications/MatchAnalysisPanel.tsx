"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import {
  formatListMatchScoreLabel,
  formatMatchCategory,
  formatMatchScore,
  formatRecommendedAction,
  listMatchScorePillClassName,
  matchCategoryBadgeClassName,
  matchScoreBadgeClassName,
} from "@/lib/jobs/match-analysis/display";

type RequirementRow = {
  id: string;
  requirement_text: string;
  requirement_type: string;
  status: string;
  requirement_outcome: string;
  candidate_evidence: string;
  verification_required: boolean;
  confidence: number;
  recruiter_verified: boolean;
  recruiter_note: string | null;
};

type ScreeningQuestionView = {
  id: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  answerDisplay: string;
  answered: boolean;
};

type ScreeningAssessment = {
  answered: number;
  total: number;
  requiredAnswered: number;
  requiredTotal: number;
  summary: string;
};

type MatchPayload = {
  application: {
    id: string;
    ai_match_status: string | null;
    ai_match_score: number | null;
    ai_match_category: string | null;
    ai_match_action: string | null;
    ai_match_readiness: string | null;
    ai_match_display_category: string | null;
    ai_analysis: Record<string, unknown> | null;
    ai_analyzed_at: string | null;
    ai_analysis_error: string | null;
    ai_analysis_progress: string | null;
  };
  requirements: RequirementRow[];
  screeningQuestions?: ScreeningQuestionView[];
  screeningAssessment?: ScreeningAssessment | null;
};

type Props = {
  applicationId: string;
  compact?: boolean;
  onAnalyzed?: () => void;
  /** Bump to force a reload (e.g. after resume re-upload). */
  reloadToken?: number;
};

export function MatchAnalysisPanel({
  applicationId,
  compact = false,
  onAnalyzed,
  reloadToken = 0,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<MatchPayload | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/match-analysis`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load match analysis");
      setData(json as MatchPayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load match analysis");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/match-analysis`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Match analysis failed");
      toast.success(
        json.status === "NEEDS_REVIEW"
          ? "Needs résumé text before analysis"
          : "Match analysis complete"
      );
      await load();
      onAnalyzed?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Match analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleVerified = async (req: RequirementRow) => {
    setVerifyingId(req.id);
    try {
      const res = await fetch(
        `/api/admin/job-applications/${applicationId}/match-analysis/requirements/${req.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recruiterVerified: !req.recruiter_verified }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update verification");
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          requirements: prev.requirements.map((row) =>
            row.id === req.id
              ? {
                  ...row,
                  recruiter_verified: Boolean(json.requirement?.recruiter_verified),
                  recruiter_note: json.requirement?.recruiter_note ?? row.recruiter_note,
                }
              : row
          ),
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
    } finally {
      setVerifyingId(null);
    }
  };

  const app = data?.application;
  const analysis = (app?.ai_analysis ?? null) as {
    screening_questions?: Array<{
      priority: number;
      question: string;
      reason: string;
      related_requirement: string;
    }>;
    strengths?: string[];
    gaps_and_risks?: string[];
    candidate_match?: { recruiter_decision_summary?: string };
  } | null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-6 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading match analysis…
      </div>
    );
  }

  const status = app?.ai_match_status ?? "READY";
  const isAnalyzed = status === "ANALYZED";

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <Sparkles className="h-4 w-4 text-[var(--brand-primary,#0F766E)]" />
            Job match analysis
          </div>
          {app?.ai_analysis_progress && status === "ANALYZING" ? (
            <p className="mt-0.5 text-xs text-[#64748B]">Progress: {app.ai_analysis_progress}</p>
          ) : null}
          {app?.ai_analysis_error ? (
            <p className="mt-0.5 text-xs text-[#B91C1C]">{app.ai_analysis_error}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void runAnalyze()}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isAnalyzed ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {analyzing ? "Analyzing…" : isAnalyzed ? "Reanalyze" : "Analyze"}
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {!isAnalyzed ? (
          <p className="text-sm text-[#64748B]">
            {status === "NEEDS_REVIEW"
              ? "Upload or extract résumé text, then run analysis."
              : status === "FAILED"
                ? "Previous analysis failed. Try again."
                : "Run AI match analysis to score this candidate against the job."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${matchScoreBadgeClassName(app?.ai_match_score)}`}
              >
                {formatMatchScore(app?.ai_match_score)}
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${matchCategoryBadgeClassName(app?.ai_match_category)}`}
              >
                {app?.ai_match_display_category || formatMatchCategory(app?.ai_match_category)}
              </span>
              {app?.ai_match_action ? (
                <span className="text-xs font-medium text-[#475569]">
                  {formatRecommendedAction(app.ai_match_action)}
                </span>
              ) : null}
            </div>

            {analysis?.candidate_match?.recruiter_decision_summary ? (
              <p className="text-sm text-[#334155]">
                {analysis.candidate_match.recruiter_decision_summary}
              </p>
            ) : null}

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Screening questions
              </h4>
              {data?.screeningAssessment?.total ? (
                <>
                  <p className="mb-2 text-xs text-[#64748B]">
                    {data.screeningAssessment.summary}
                  </p>
                  <ul className="space-y-2">
                    {(data.screeningQuestions ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 text-sm ${item.answered ? "text-[#16A34A]" : "text-[#D97706]"}`}
                            aria-hidden
                          >
                            {item.answered ? "✓" : "!"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#0F172A]">
                              {item.question}
                              {item.isRequired ? (
                                <span className="ml-1 text-[10px] font-semibold uppercase text-[#64748B]">
                                  Required
                                </span>
                              ) : null}
                            </p>
                            <p
                              className={`mt-1 text-sm ${item.answered ? "text-[#334155]" : "text-[#94A3B8] italic"}`}
                            >
                              {item.answerDisplay}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[#64748B]">
                  No screening questions were configured for this job.
                </p>
              )}
            </div>

            {!compact && analysis?.strengths?.length ? (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Strengths
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {analysis.strengths.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!compact && analysis?.gaps_and_risks?.length ? (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Gaps & risks
                </h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[#334155]">
                  {analysis.gaps_and_risks.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Requirements
              </h4>
              <ul className="space-y-2">
                {(data?.requirements ?? []).slice(0, compact ? 6 : 40).map((req) => (
                  <li
                    key={req.id}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                            {req.requirement_type}
                          </span>
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#475569] ring-1 ring-[#E2E8F0]">
                            {req.status}
                          </span>
                          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#475569] ring-1 ring-[#E2E8F0]">
                            {req.requirement_outcome}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[#0F172A]">{req.requirement_text}</p>
                        {req.candidate_evidence ? (
                          <p className="mt-1 text-xs text-[#64748B]">“{req.candidate_evidence}”</p>
                        ) : null}
                      </div>
                      <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[#475569]">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-[#CBD5E1]"
                          checked={req.recruiter_verified}
                          disabled={verifyingId === req.id}
                          onChange={() => void toggleVerified(req)}
                        />
                        Verified
                      </label>
                    </div>
                  </li>
                ))}
                {!data?.requirements?.length ? (
                  <li className="text-sm text-[#64748B]">No requirement rows stored.</li>
                ) : null}
              </ul>
            </div>

            {!compact && analysis?.screening_questions?.length ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Suggested follow-up questions
                </h4>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-[#334155]">
                  {analysis.screening_questions.map((q) => (
                    <li key={`${q.priority}-${q.question}`}>
                      <span className="font-medium">{q.question}</span>
                      {q.reason ? (
                        <span className="mt-0.5 block text-xs text-[#64748B]">{q.reason}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Compact list-cell display for match score (Figma: solid pill + BEST/GOOD/WEAK MATCH). */
export function MatchScoreCell(props: {
  status: string | null | undefined;
  score: number | null | undefined;
  category?: string | null | undefined;
  displayCategory?: string | null;
  onAnalyze?: () => void;
  analyzing?: boolean;
}) {
  const { status, score, onAnalyze, analyzing } = props;

  if (status === "ANALYZING" || analyzing) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#64748B]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Analyzing…
      </span>
    );
  }

  if (status === "ANALYZED") {
    const label = formatListMatchScoreLabel(score);
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <span
          className={`inline-flex h-5 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none tabular-nums ${listMatchScorePillClassName(score)}`}
        >
          {formatMatchScore(score)}
        </span>
        {label ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAnalyze}
      className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#F8FAFC]"
    >
      <Sparkles className="h-3 w-3" />
      Analyze
    </button>
  );
}

export function RequirementOutcomeCountCell(props: {
  value: number | null | undefined;
  tone: "conf" | "verify" | "notMet";
  analyzed?: boolean;
}) {
  if (!props.analyzed || props.value == null) {
    return <span className="text-sm text-[#94A3B8]">—</span>;
  }
  const color =
    props.tone === "conf"
      ? "text-[#16A34A]"
      : props.tone === "verify"
        ? "text-[#EA580C]"
        : "text-[#DC2626]";
  return <span className={`text-sm font-semibold tabular-nums ${color}`}>{props.value}</span>;
}
