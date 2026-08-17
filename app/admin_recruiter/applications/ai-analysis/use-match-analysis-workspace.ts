"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  RECRUITER_DECISIONS,
  type QualificationRequirement,
  type RecruiterDecision,
  type VerifiedInfoCategory,
} from "@/lib/jobs/match-analysis/workspace";

export type ScreeningQuestionView = {
  id: string;
  question: string;
  isRequired: boolean;
  answerDisplay: string;
  answered: boolean;
  answer: unknown;
};

export type MatchAnalysisWorkspacePayload = {
  application: {
    id: string;
    worker_id?: string | null;
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

export type WorkerProfileSummary = {
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  job_role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type TeamMember = { id: string; name: string; email: string };

export type CandidateInfoState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialty: string;
  location: string;
};

export type MatchAnalysisParsed = {
  candidate_match?: {
    recruiter_decision_summary?: string;
    confidence_score?: number;
  };
  job?: { job_title?: string };
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
    job_description_conflicts?: string[];
  };
  experience_analysis?: {
    experience_calculation_notes?: string[];
  };
};

export function parseMatchAnalysis(
  value: Record<string, unknown> | null | undefined
): MatchAnalysisParsed | null {
  if (!value || typeof value !== "object") return null;
  return value as MatchAnalysisParsed;
}

export function useMatchAnalysisWorkspace(applicationId: string, reloadToken = 0) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<MatchAnalysisWorkspacePayload | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileSummary | null>(null);
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
  const [info, setInfo] = useState<CandidateInfoState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialty: "",
    location: "",
  });
  const [savingInfo, setSavingInfo] = useState(false);
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
      const payload = json as MatchAnalysisWorkspacePayload;
      setData(payload);
      setWorkerId(payload.application.worker_id ? String(payload.application.worker_id) : null);
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
    void fetch("/api/admin/team-members", { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { members?: TeamMember[] };
        if (res.ok) setTeamMembers(json.members ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;
    void fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          worker?: WorkerProfileSummary;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Failed to load profile");
        setProfile(json.worker ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  useEffect(() => {
    if (!profile) return;
    setInfo({
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      specialty: profile.job_role || "",
      location: [profile.city, profile.state].filter(Boolean).join(", "),
    });
  }, [profile]);

  const analysis = parseMatchAnalysis(data?.application.ai_analysis);
  const blocking = analysis?.submission_readiness?.blocking_requirements ?? [];
  const verifyItems = analysis?.submission_readiness?.items_to_verify_before_submission ?? [];
  const status = data?.application.ai_match_status ?? "READY";
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
        extracted?: CandidateInfoState;
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
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save extracted text");
    } finally {
      setSavingText(false);
    }
  }

  return {
    loading,
    analyzing,
    data,
    workerId,
    profile,
    analysis,
    blocking,
    verifyItems,
    status,
    isAnalyzed,
    verifyingId,
    jobAnswers,
    setJobAnswers,
    recommendedAnswers,
    setRecommendedAnswers,
    savingAnswers,
    decision,
    setDecision,
    decisionNote,
    setDecisionNote,
    savingDecision,
    verifiedTitle,
    setVerifiedTitle,
    verifiedDetails,
    setVerifiedDetails,
    verifiedCategory,
    setVerifiedCategory,
    savingVerified,
    teamMembers,
    assignedId,
    setAssignedId,
    info,
    setInfo,
    savingInfo,
    extractedDraft,
    setExtractedDraft,
    savingText,
    load,
    runAnalyze,
    toggleVerified,
    saveScreeningAnswers,
    recordDecision,
    addVerified,
    saveDetails,
    reextractContact,
    saveExtractedText,
    decisionOptions: RECRUITER_DECISIONS,
  };
}
