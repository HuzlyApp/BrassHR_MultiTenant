"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import {
  formatMatchCategory,
  formatMatchScore,
  formatRecommendedAction,
  matchCategoryBadgeClassName,
  matchScoreBadgeClassName,
} from "@/lib/jobs/match-analysis/display";
import {
  RECRUITER_DECISIONS,
  RECRUITER_DECISION_LABELS,
  VERIFIED_INFO_CATEGORIES,
  VERIFIED_INFO_CATEGORY_LABELS,
  formatRecruiterDecision,
  type QualificationRequirement,
  type RecruiterDecision,
  type VerifiedInfoCategory,
} from "@/lib/jobs/match-analysis/workspace";
import { QualificationChecklist } from "./QualificationChecklist";

type ScreeningQuestionView = {
  id: string;
  question: string;
  isRequired: boolean;
  answerDisplay: string;
  answered: boolean;
  answer: unknown;
};

type WorkspacePayload = {
  application: {
    id: string;
    ai_match_status: string | null;
    ai_match_score: number | null;
    ai_match_category: string | null;
    ai_match_action: string | null;
    ai_match_display_category: string | null;
    ai_analysis: Record<string, unknown> | null;
    ai_analysis_error: string | null;
    ai_analysis_version: number | null;
    ai_analysis_model: string | null;
    recruiter_decision: string | null;
    recruiter_decision_note: string | null;
    recruiter_decision_at: string | null;
  };
  requirements: QualificationRequirement[];
  screeningQuestions?: ScreeningQuestionView[];
  recommendedQuestions?: Array<{
    key: string;
    priority: number;
    question: string;
    reason: string;
    relatedRequirement: string;
    answer: string;
  }>;
  verifiedInformation?: Array<{
    id: string;
    category: string;
    title: string;
    details: string | null;
    verifiedAt: string;
    verifiedByName: string;
  }>;
  notes?: Array<{ id: string; body: string; created_at: string; author_name: string }>;
  analysisHistory?: Array<{
    id: string;
    version: number;
    score: number | null;
    category: string | null;
    display_category: string | null;
    model: string | null;
    analyzed_at: string;
  }>;
  extractedResume?: { text: string; fileName: string | null } | null;
  assignedRecruiter?: { id: string; name: string } | null;
  modelName?: string | null;
};

type TeamMember = { id: string; name: string; email: string };

type Props = {
  applicationId: string;
  workerId: string | null;
  candidateName: string;
  profile: {
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    job_role?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  onAnalyzed?: () => void;
  reloadToken?: number;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateAnalysisWorkspace({
  applicationId,
  workerId,
  candidateName,
  profile,
  onAnalyzed,
  reloadToken = 0,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [jobAnswers, setJobAnswers] = useState<Record<string, string>>({});
  const [recommendedAnswers, setRecommendedAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [decision, setDecision] = useState<RecruiterDecision | "">("");
  const [decisionNote, setDecisionNote] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [verifiedTitle, setVerifiedTitle] = useState("");
  const [verifiedDetails, setVerifiedDetails] = useState("");
  const [verifiedCategory, setVerifiedCategory] = useState<VerifiedInfoCategory>("note");
  const [savingVerified, setSavingVerified] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedId, setAssignedId] = useState("");
  const [info, setInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialty: "",
    location: "",
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [extractedOpen, setExtractedOpen] = useState(false);
  const [extractedDraft, setExtractedDraft] = useState("");
  const [savingText, setSavingText] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/match-analysis`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load match analysis");
      const payload = json as WorkspacePayload;
      setData(payload);
      setDecision((payload.application.recruiter_decision as RecruiterDecision) || "");
      setDecisionNote(payload.application.recruiter_decision_note || "");
      setAssignedId(payload.assignedRecruiter?.id || "");
      const rec: Record<string, string> = {};
      for (const item of payload.recommendedQuestions ?? []) rec[item.key] = item.answer || "";
      setRecommendedAnswers(rec);
      const jobs: Record<string, string> = {};
      for (const item of payload.screeningQuestions ?? []) {
        jobs[item.id] = item.answered ? String(item.answer ?? "") : "";
      }
      setJobAnswers(jobs);
      setExtractedDraft(payload.extractedResume?.text || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load match analysis");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  useEffect(() => {
    setInfo({
      firstName: profile?.first_name || candidateName.split(" ")[0] || "",
      lastName: profile?.last_name || candidateName.split(" ").slice(1).join(" ") || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      specialty: profile?.job_role || "",
      location: [profile?.city, profile?.state].filter(Boolean).join(", "),
    });
  }, [profile, candidateName]);

  useEffect(() => {
    void fetch("/api/admin/team-members", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { members?: TeamMember[] };
        if (res.ok) setTeamMembers(json.members ?? []);
      })
      .catch(() => undefined);
  }, []);

  const analysis = (data?.application.ai_analysis ?? null) as {
    candidate_match?: { recruiter_decision_summary?: string; confidence_score?: number };
    strengths?: string[];
    gaps_and_risks?: string[];
    submission_readiness?: {
      items_to_verify_before_submission?: string[];
      blocking_requirements?: string[];
    };
    data_quality?: {
      resume_completeness?: string;
      job_description_completeness?: string;
      resume_conflicts?: string[];
      missing_information?: string[];
    };
  } | null;

  const blocking = analysis?.submission_readiness?.blocking_requirements ?? [];
  const verifyItems = analysis?.submission_readiness?.items_to_verify_before_submission ?? [];
  const modelLabel = data?.modelName || data?.application.ai_analysis_model || "Grok";
  const app = data?.application;
  const status = app?.ai_match_status ?? "READY";
  const isAnalyzed = status === "ANALYZED";

  async function runAnalyze() {
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
  }

  async function toggleVerified(req: QualificationRequirement) {
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
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification update failed");
    } finally {
      setVerifyingId(null);
    }
  }

  async function saveScreeningAnswers() {
    setSavingAnswers(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/screening-answers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobAnswers: Object.entries(jobAnswers).map(([questionId, answer]) => ({ questionId, answer })),
          recommendedAnswers: (data?.recommendedQuestions ?? []).map((item) => ({
            key: item.key,
            question: item.question,
            priority: item.priority,
            answer: recommendedAnswers[item.key] ?? "",
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save screening answers");
      toast.success("Screening answers saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save screening answers");
    } finally {
      setSavingAnswers(false);
    }
  }

  async function recordDecision() {
    if (!decision) {
      toast.error("Select a recruiter decision first.");
      return;
    }
    setSavingDecision(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: decisionNote }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to record decision");
      toast.success("Decision recorded");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record decision");
    } finally {
      setSavingDecision(false);
    }
  }

  async function addVerified() {
    if (!verifiedTitle.trim()) {
      toast.error("Add a title for verified information.");
      return;
    }
    setSavingVerified(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/verified-information`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: verifiedCategory,
          title: verifiedTitle,
          details: verifiedDetails,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save verified information");
      setVerifiedTitle("");
      setVerifiedDetails("");
      toast.success("Verified information added");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save verified information");
    } finally {
      setSavingVerified(false);
    }
  }

  async function saveDetails() {
    if (!workerId) {
      toast.error("This applicant is not linked to a worker profile yet.");
      return;
    }
    setSavingInfo(true);
    try {
      const assignRes = await fetch(`/api/admin/job-applications/${applicationId}/assignment`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRecruiterUserId: assignedId || null }),
      });
      const assignJson = await assignRes.json().catch(() => ({}));
      if (!assignRes.ok) throw new Error(assignJson.error || "Failed to assign recruiter");
      const fields: Array<[string, string]> = [
        ["first_name", info.firstName],
        ["last_name", info.lastName],
        ["email", info.email],
        ["phone", info.phone],
        ["job_role", info.specialty],
      ];
      for (const [field, value] of fields) {
        const res = await fetch("/api/admin/worker-profile", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId, field, value }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Failed to save ${field}`);
      }
      toast.success("Candidate details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save details");
    } finally {
      setSavingInfo(false);
    }
  }

  async function reextractContact() {
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/reextract-contact`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        extracted?: typeof info;
      };
      if (!res.ok) throw new Error(json.error || "Could not extract contact details");
      if (!json.extracted) return;
      if (!window.confirm("Replace current contact fields with values extracted from the résumé?")) {
        return;
      }
      setInfo((current) => ({
        firstName: json.extracted?.firstName || current.firstName,
        lastName: json.extracted?.lastName || current.lastName,
        email: json.extracted?.email || current.email,
        phone: json.extracted?.phone || current.phone,
        specialty: json.extracted?.specialty || current.specialty,
        location: json.extracted?.location || current.location,
      }));
      toast.success("Extracted contact details. Review and save.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extract contact details");
    }
  }

  async function saveExtractedText() {
    setSavingText(true);
    try {
      const res = await fetch(`/api/admin/job-applications/${applicationId}/resume-text`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText: extractedDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save extracted text");
      toast.success("Extracted text saved. Reanalyze to use the corrected résumé.");
      setExtractedOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save extracted text");
    } finally {
      setSavingText(false);
    }
  }

  function copyAllQuestions() {
    const lines = [
      ...(data?.screeningQuestions ?? []).map((item, index) => `${index + 1}. ${item.question}`),
      ...(data?.recommendedQuestions ?? []).map(
        (item, index) => `${(data?.screeningQuestions?.length ?? 0) + index + 1}. ${item.question}`
      ),
    ];
    if (!lines.length) {
      toast.error("No screening questions to copy.");
      return;
    }
    void navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Questions copied");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-6 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading candidate analysis…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
              <Sparkles className="h-4 w-4 text-[var(--brand-primary,#0F766E)]" />
              Match / AI recommendation
            </div>
            {app?.ai_analysis_error ? (
              <p className="mt-1 text-xs text-[#B91C1C]">{app.ai_analysis_error}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-xs font-medium text-[#334155]">
              {modelLabel}
            </span>
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] disabled:opacity-60"
            >
              {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAnalyzed ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {analyzing ? "Analyzing…" : isAnalyzed ? "Reanalyze" : "Analyze candidate"}
            </button>
          </div>
        </div>
        {!isAnalyzed ? (
          <p className="mt-4 text-sm text-[#64748B]">
            {status === "NEEDS_REVIEW"
              ? "This candidate has not been analyzed yet. Upload or correct résumé text, then run analysis."
              : status === "FAILED"
                ? "Previous analysis failed. The last saved result was kept. Try again."
                : "This candidate has not been analyzed yet."}
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <span className={`inline-flex items-center rounded-md px-3 py-1.5 text-2xl font-semibold ${matchScoreBadgeClassName(app?.ai_match_score)}`}>
                {formatMatchScore(app?.ai_match_score)}
              </span>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ${matchCategoryBadgeClassName(app?.ai_match_category)}`}>
                {app?.ai_match_display_category || formatMatchCategory(app?.ai_match_category)}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm text-[#475569] sm:grid-cols-2">
              {analysis?.candidate_match?.confidence_score != null ? (
                <div>Confidence: {Math.round(Number(analysis.candidate_match.confidence_score))}%</div>
              ) : null}
              <div>Recommendation: {formatRecommendedAction(app?.ai_match_action)}</div>
              {app?.ai_analysis_version ? <div>Analysis version: {app.ai_analysis_version}</div> : null}
              <div>Model: {modelLabel}</div>
            </dl>
            {analysis?.candidate_match?.recruiter_decision_summary ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#334155]">
                {analysis.candidate_match.recruiter_decision_summary}
              </p>
            ) : null}
          </>
        )}
      </section>

      {isAnalyzed ? (
        <>
          <section className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
            <h3 className="text-sm font-semibold text-[#991B1B]">Verify before submission</h3>
            {blocking.length || verifyItems.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#7F1D1D]">
                {(blocking.length ? blocking : verifyItems).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#7F1D1D]">No blocking verification items</p>
            )}
          </section>
          <QualificationChecklist
            requirements={data?.requirements ?? []}
            blockingTexts={blocking}
            verifyingId={verifyingId}
            onToggleVerified={(req) => void toggleVerified(req)}
          />
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">Documented strengths</h3>
            {analysis?.strengths?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {analysis.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#64748B]">No documented strengths in this analysis.</p>
            )}
          </section>
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">Verification needs</h3>
            <p className="mt-1 text-xs text-[#64748B]">Items to confirm during screening — not confirmed failures.</p>
            {verifyItems.length || analysis?.gaps_and_risks?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                {(verifyItems.length ? verifyItems : analysis?.gaps_and_risks ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#64748B]">No additional verification items identified.</p>
            )}
          </section>
        </>
      ) : null}

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0F172A]">Recommended screening questions</h3>
          <button type="button" onClick={copyAllQuestions} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155]">
            Copy all
          </button>
        </div>
        {(data?.screeningQuestions ?? []).map((item, index) => (
          <div key={item.id} className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-sm font-medium text-[#0F172A]">{index + 1}. {item.question}</p>
            <textarea value={jobAnswers[item.id] ?? ""} onChange={(event) => setJobAnswers((current) => ({ ...current, [item.id]: event.target.value }))} rows={2} className="mt-2 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm" placeholder="Candidate answer" />
          </div>
        ))}
        {!data?.screeningQuestions?.length ? (
          <p className="mt-3 text-sm text-[#64748B]">No screening questions were configured for this job.</p>
        ) : null}
        {(data?.recommendedQuestions ?? []).map((item, index) => (
          <div key={item.key} className="mt-3 rounded-lg border border-[#E2E8F0] p-3">
            <p className="text-sm font-medium text-[#0F172A]">{(data?.screeningQuestions?.length ?? 0) + index + 1}. {item.question}</p>
            {item.reason ? <p className="mt-1 text-xs text-[#64748B]">Why this matters: {item.reason}</p> : null}
            <textarea value={recommendedAnswers[item.key] ?? ""} onChange={(event) => setRecommendedAnswers((current) => ({ ...current, [item.key]: event.target.value }))} rows={2} className="mt-2 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm" placeholder="Candidate answer" />
          </div>
        ))}
        <button type="button" disabled={savingAnswers} onClick={() => void saveScreeningAnswers()} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}>
          {savingAnswers ? "Saving…" : "Save screening answers"}
        </button>
      </section>

      {isAnalyzed && analysis?.data_quality ? (
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#0F172A]">Data quality & analysis notes</h3>
          <dl className="mt-2 grid gap-2 text-sm text-[#475569] sm:grid-cols-2">
            {analysis.data_quality.resume_completeness ? <div>Résumé completeness: {analysis.data_quality.resume_completeness}</div> : null}
            {analysis.data_quality.job_description_completeness ? <div>Job completeness: {analysis.data_quality.job_description_completeness}</div> : null}
          </dl>
        </section>
      ) : null}

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Candidate information</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Assigned recruiter</span>
            <select value={assignedId} onChange={(event) => setAssignedId(event.target.value)} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm">
              <option value="">Unassigned</option>
              {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Full name</span>
            <input value={`${info.firstName} ${info.lastName}`.trim()} onChange={(event) => { const [first, ...rest] = event.target.value.split(" "); setInfo((current) => ({ ...current, firstName: first || "", lastName: rest.join(" ") })); }} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Email</span>
            <input value={info.email} onChange={(event) => setInfo((current) => ({ ...current, email: event.target.value }))} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Phone</span>
            <input value={info.phone} onChange={(event) => setInfo((current) => ({ ...current, phone: event.target.value }))} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Specialty</span>
            <input value={info.specialty} onChange={(event) => setInfo((current) => ({ ...current, specialty: event.target.value }))} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm" />
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium text-[#334155]">Location</span>
            <input value={info.location} onChange={(event) => setInfo((current) => ({ ...current, location: event.target.value }))} className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={savingInfo} onClick={() => void saveDetails()} className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}>{savingInfo ? "Saving…" : "Save details"}</button>
          <button type="button" onClick={() => void reextractContact()} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#334155]">Re-extract contact details</button>
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Extracted résumé text</h3>
        {data?.extractedResume?.text ? (
          <>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F8FAFC] p-3 text-xs text-[#334155]">{data.extractedResume.text.slice(0, 1200)}{data.extractedResume.text.length > 1200 ? "…" : ""}</pre>
            {extractedOpen ? (
              <div className="mt-3">
                <textarea value={extractedDraft} onChange={(event) => setExtractedDraft(event.target.value)} rows={10} className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm" />
                <button type="button" disabled={savingText} onClick={() => void saveExtractedText()} className="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}>{savingText ? "Saving…" : "Save extracted text"}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setExtractedOpen(true)} className="mt-3 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#334155]">Correct extracted text</button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-[#64748B]">No extracted résumé text is stored for this application.</p>
        )}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Verified information</h3>
        {(data?.verifiedInformation ?? []).length ? (
          <ul className="mt-3 space-y-2">
            {data?.verifiedInformation?.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <p className="text-xs font-semibold uppercase text-[#64748B]">{VERIFIED_INFO_CATEGORY_LABELS[item.category as VerifiedInfoCategory] || item.category}</p>
                <p className="text-sm font-medium text-[#0F172A]">{item.title}</p>
                {item.details ? <p className="text-sm text-[#475569]">{item.details}</p> : null}
                <p className="mt-1 text-xs text-[#94A3B8]">Verified by {item.verifiedByName} · {formatWhen(item.verifiedAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#64748B]">No recruiter-verified information yet.</p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr]">
          <select value={verifiedCategory} onChange={(event) => setVerifiedCategory(event.target.value as VerifiedInfoCategory)} className="h-10 rounded-lg border border-[#CBD5E1] px-3 text-sm">
            {VERIFIED_INFO_CATEGORIES.map((category) => <option key={category} value={category}>{VERIFIED_INFO_CATEGORY_LABELS[category]}</option>)}
          </select>
          <input value={verifiedTitle} onChange={(event) => setVerifiedTitle(event.target.value)} placeholder="Title" className="h-10 rounded-lg border border-[#CBD5E1] px-3 text-sm" />
        </div>
        <textarea value={verifiedDetails} onChange={(event) => setVerifiedDetails(event.target.value)} rows={2} placeholder="Details" className="mt-2 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm" />
        <button type="button" disabled={savingVerified} onClick={() => void addVerified()} className="mt-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#334155] disabled:opacity-60">{savingVerified ? "Saving…" : "Add verified information"}</button>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Notes</h3>
        {(data?.notes ?? []).length ? (
          <ul className="mt-3 space-y-2">
            {data?.notes?.map((note) => (
              <li key={note.id} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">
                <p className="text-[#334155]">{note.body}</p>
                <p className="mt-1 text-xs text-[#94A3B8]">{note.author_name} · {formatWhen(note.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#64748B]">No notes yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Final decision</h3>
        <p className="mt-1 text-sm text-[#64748B]">Kept separate from the AI recommendation.{app?.ai_match_action ? ` AI recommendation: ${formatRecommendedAction(app.ai_match_action)}` : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {RECRUITER_DECISIONS.map((value) => (
            <button key={value} type="button" onClick={() => setDecision(value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${decision === value ? "border-[#0F172A] bg-[#0F172A] text-white" : "border-[#CBD5E1] bg-white text-[#334155]"}`}>
              {RECRUITER_DECISION_LABELS[value]}
            </button>
          ))}
        </div>
        <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} rows={2} placeholder="Optional note" className="mt-3 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm" />
        <button type="button" disabled={savingDecision} onClick={() => void recordDecision()} className="mt-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}>{savingDecision ? "Saving…" : "Record decision"}</button>
        {app?.recruiter_decision ? <p className="mt-2 text-xs text-[#64748B]">Current: {formatRecruiterDecision(app.recruiter_decision)}{app.recruiter_decision_at ? ` · ${formatWhen(app.recruiter_decision_at)}` : ""}</p> : null}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Analysis history</h3>
        {(data?.analysisHistory ?? []).length ? (
          <ul className="mt-3 space-y-2">
            {data?.analysisHistory?.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">
                <p className="font-medium text-[#0F172A]">Version {item.version} · {formatMatchScore(item.score)} · {item.display_category || formatMatchCategory(item.category)}</p>
                <p className="text-xs text-[#94A3B8]">{formatWhen(item.analyzed_at)}{item.model ? ` · ${item.model}` : ""}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#64748B]">No previous analysis versions.</p>
        )}
      </section>
    </div>
  );
}
