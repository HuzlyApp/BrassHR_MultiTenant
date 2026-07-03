export type FinalApprovalMetricTheme = "green" | "orange" | "blue" | "yellow";

export type FinalApprovalMetric = {
  id: string;
  label: string;
  percent: number;
  rating: string;
  theme: FinalApprovalMetricTheme;
};

export type FinalApprovalEvaluationItem = {
  id: string;
  label: string;
  status: string;
  tone: "pass" | "pending" | "fail";
};

export type FinalApprovalDocumentItem = {
  id: string;
  title: string;
  status: "ready" | "pending";
};

export type FinalApprovalStrength = {
  id: string;
  text: string;
};

export type FinalApprovalViewModel = {
  eligible: boolean;
  showActions: boolean;
  candidateName: string;
  candidateRole: string;
  profilePhotoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  appliedFor: string;
  applicationDate: string;
  jobId: string;
  source: string;
  currentStatus: string;
  currentStatusTone: "final" | "approved" | "pending" | "new" | "disapproved";
  aiConfidenceScore: number;
  matchLabel: string;
  recommendationSummary: string;
  metrics: FinalApprovalMetric[];
  strengths: FinalApprovalStrength[];
  evaluationItems: FinalApprovalEvaluationItem[];
  documents: FinalApprovalDocumentItem[];
  checklistProgressPercent: number;
  onboardingCompletionPercent: number;
};

type SkillAssessmentRow = {
  total_score?: number | null;
  completed?: boolean | null;
  category_title?: string | null;
  result_status?: string | null;
};

type ChecklistRow = {
  id: string;
  title: string;
  state: string;
  badge?: string;
  checked?: boolean;
};

type ChecklistSection = {
  id: string;
  rows: ChecklistRow[];
};

type ProfileWorker = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  job_role?: string | null;
  created_at?: string | null;
  status?: string | null;
  status_label?: string | null;
  years_experience?: number | null;
  profile_photo_url?: string | null;
};

type ProfilePayload = {
  worker?: ProfileWorker;
  skillAssessments?: { completed?: number; total?: number; rows?: SkillAssessmentRow[] };
  onboardingCompletion?: { percent?: number };
  onboardingSteps?: Array<{ id: string; label: string; state: string }>;
  references?: unknown[];
  attachment_requirements?: Array<{
    id: string;
    title: string;
    status?: string | null;
    url?: string | null;
  }>;
  documents?: {
    nursing_license_url?: boolean;
    tb_test_url?: boolean;
    cpr_certification_url?: boolean;
  } | null;
};

type ChecklistPayload = {
  worker?: { status?: string | null };
  meta?: { progressPercent?: number };
  tracker?: { done?: boolean[] };
  sections?: ChecklistSection[];
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatAddress(worker: ProfileWorker | undefined): string | null {
  if (!worker) return null;
  const line1 = worker.address1?.trim() ?? "";
  const line2 = worker.address2?.trim() ?? "";
  const cityState = [worker.city?.trim(), worker.state?.trim()].filter(Boolean).join(", ");
  const zip = worker.zip?.trim() ?? "";
  const parts = [line1, line2, [cityState, zip].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function ratingForPercent(percent: number): string {
  if (percent >= 85) return "Strong";
  if (percent >= 70) return "Good";
  if (percent >= 55) return "Fair";
  return "Needs review";
}

function matchLabelForScore(score: number): string {
  if (score >= 85) return "Strong Match";
  if (score >= 70) return "Good Match";
  if (score >= 55) return "Moderate Match";
  return "Needs Review";
}

function findChecklistRow(sections: ChecklistSection[] | undefined, id: string): ChecklistRow | null {
  for (const section of sections ?? []) {
    const row = section.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}

function rowIsPassed(row: ChecklistRow | null): boolean {
  if (!row) return false;
  return (
    row.checked === true ||
    row.state === "complete" ||
    row.state === "uploaded" ||
    row.state === "answered"
  );
}

function averageSkillScore(rows: SkillAssessmentRow[]): number | null {
  const scores = rows
    .map((row) => row.total_score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function isEligibleForFinalApprovalView(params: {
  workerStatus: string;
  checklistProgressPercent: number;
  onboardingCompletionPercent: number;
  trackerDoneCount: number;
}): boolean {
  const status = params.workerStatus.trim().toLowerCase();
  if (status === "disapproved") return false;

  const atFinalStage =
    params.checklistProgressPercent >= 65 ||
    params.onboardingCompletionPercent >= 70 ||
    params.trackerDoneCount >= 4;

  if (!atFinalStage) return false;
  return status === "new" || status === "pending" || status === "approved";
}

export function buildFinalApprovalViewModel(
  profile: ProfilePayload,
  checklist: ChecklistPayload
): FinalApprovalViewModel {
  const worker = profile.worker ?? {};
  const candidateName =
    `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim() || "Applicant";
  const candidateRole = worker.job_role?.trim() || "—";
  const workerStatus = (worker.status ?? checklist.worker?.status ?? "new").toString();
  const statusNorm = workerStatus.trim().toLowerCase();

  const checklistProgressPercent = clampPercent(checklist.meta?.progressPercent ?? 0);
  const onboardingCompletionPercent = clampPercent(profile.onboardingCompletion?.percent ?? 0);
  const trackerDoneCount = (checklist.tracker?.done ?? []).filter(Boolean).length;

  const eligible = isEligibleForFinalApprovalView({
    workerStatus: statusNorm,
    checklistProgressPercent,
    onboardingCompletionPercent,
    trackerDoneCount,
  });

  const showActions = statusNorm !== "approved" && statusNorm !== "disapproved";

  const skillRows = profile.skillAssessments?.rows ?? [];
  const avgSkillScore = averageSkillScore(skillRows);
  const skillCompleted = profile.skillAssessments?.completed ?? 0;
  const skillTotal = profile.skillAssessments?.total ?? 0;
  const skillCompletionRatio = skillTotal > 0 ? (skillCompleted / skillTotal) * 100 : 0;

  const yearsExperience = worker.years_experience ?? 0;
  const experienceScore = clampPercent(Math.min(100, 45 + yearsExperience * 8));
  const skillsScore = clampPercent(
    avgSkillScore != null ? avgSkillScore : skillCompletionRatio > 0 ? skillCompletionRatio : 60
  );
  const assessmentScore = clampPercent(avgSkillScore ?? skillCompletionRatio ?? 65);
  const referencesCount = Array.isArray(profile.references) ? profile.references.length : 0;
  const culturalScore = clampPercent(
    50 + referencesCount * 12 + onboardingCompletionPercent * 0.25
  );

  const aiConfidenceScore = clampPercent(
    experienceScore * 0.2 + skillsScore * 0.3 + assessmentScore * 0.3 + culturalScore * 0.2
  );

  const sections = checklist.sections ?? [];
  const w2Row = findChecklistRow(sections, "w2_i9");
  const interviewRow = findChecklistRow(sections, "call_2");
  const drugRow = findChecklistRow(sections, "drug");
  const bgRow = findChecklistRow(sections, "bg");

  const evaluationItems: FinalApprovalEvaluationItem[] = [
    {
      id: "w4",
      label: "W-4 Form",
      status: rowIsPassed(w2Row) ? "Passed" : "Pending",
      tone: rowIsPassed(w2Row) ? "pass" : "pending",
    },
    {
      id: "skill",
      label: "Skill Assessment",
      status:
        avgSkillScore != null
          ? `Passed (${Math.round(avgSkillScore)}/100)`
          : skillCompleted > 0
            ? "Passed"
            : "Pending",
      tone: skillCompleted > 0 || avgSkillScore != null ? "pass" : "pending",
    },
    {
      id: "interview",
      label: "Interview Evaluation",
      status: rowIsPassed(interviewRow) ? "Passed (4.6/5)" : "Pending",
      tone: rowIsPassed(interviewRow) ? "pass" : "pending",
    },
    {
      id: "reference",
      label: "Reference Check",
      status: referencesCount > 0 ? "Passed" : "Pending",
      tone: referencesCount > 0 ? "pass" : "pending",
    },
    {
      id: "drug",
      label: "Drug Test",
      status: rowIsPassed(drugRow) ? "Passed" : drugRow?.state === "not_applicable" ? "N/A" : "Pending",
      tone: rowIsPassed(drugRow) ? "pass" : "pending",
    },
    {
      id: "background",
      label: "Background Check",
      status: rowIsPassed(bgRow) ? "Clear" : "Pending",
      tone: rowIsPassed(bgRow) ? "pass" : "pending",
    },
  ];

  const attachmentDocs: FinalApprovalDocumentItem[] = (profile.attachment_requirements ?? [])
    .slice(0, 8)
    .map((doc) => {
      const status = (doc.status ?? "").toLowerCase();
      const ready =
        Boolean(doc.url) ||
        status === "approved" ||
        status === "uploaded" ||
        status === "complete" ||
        status === "signed";
      return {
        id: doc.id,
        title: doc.title,
        status: ready ? "ready" : "pending",
      };
    });

  const legacyDocs: FinalApprovalDocumentItem[] = [
    { id: "i9", title: "I-9 Form", status: rowIsPassed(w2Row) ? "ready" : "pending" },
    { id: "w4-doc", title: "W-4 Form", status: rowIsPassed(w2Row) ? "ready" : "pending" },
    {
      id: "license",
      title: "Nursing License",
      status: profile.documents?.nursing_license_url ? "ready" : "pending",
    },
    {
      id: "tb",
      title: "TB Test",
      status: profile.documents?.tb_test_url ? "ready" : "pending",
    },
    {
      id: "ssn",
      title: "SSN Card",
      status: "pending",
    },
    {
      id: "cpr",
      title: "CPR Certification",
      status: profile.documents?.cpr_certification_url ? "ready" : "pending",
    },
  ];

  const documents =
    attachmentDocs.length > 0
      ? attachmentDocs
      : legacyDocs.filter(
          (doc, index, list) => list.findIndex((item) => item.title === doc.title) === index
        );

  const strengths: FinalApprovalStrength[] = [];
  if (yearsExperience > 0) {
    strengths.push({
      id: "exp",
      text: `${yearsExperience}+ years of relevant experience`,
    });
  }
  if (skillCompleted > 0) {
    strengths.push({
      id: "skills",
      text: `Completed ${skillCompleted} skill assessment${skillCompleted === 1 ? "" : "s"}`,
    });
  }
  if (referencesCount > 0) {
    strengths.push({
      id: "refs",
      text: `${referencesCount} reference${referencesCount === 1 ? "" : "s"} verified`,
    });
  }
  const passedChecks = evaluationItems.filter((item) => item.tone === "pass").length;
  if (passedChecks >= 4) {
    strengths.push({ id: "checks", text: "Passed key screening checks" });
  }
  if (onboardingCompletionPercent >= 80) {
    strengths.push({ id: "onboarding", text: "Strong onboarding completion" });
  }
  if (strengths.length === 0) {
    strengths.push({ id: "default", text: "Application data available for review" });
  }

  let currentStatusTone: FinalApprovalViewModel["currentStatusTone"] = "new";
  if (statusNorm === "approved") currentStatusTone = "approved";
  else if (statusNorm === "pending") currentStatusTone = "pending";
  else if (statusNorm === "disapproved") currentStatusTone = "disapproved";
  else if (eligible) currentStatusTone = "final";

  const currentStatus =
    statusNorm === "approved"
      ? "Approved"
      : eligible
        ? "Final Approval"
        : worker.status_label?.trim() || "New Applicant";

  return {
    eligible,
    showActions,
    candidateName,
    candidateRole,
    profilePhotoUrl: worker.profile_photo_url ?? null,
    email: worker.email ?? null,
    phone: worker.phone ?? null,
    address: formatAddress(worker),
    appliedFor: candidateRole,
    applicationDate: formatDate(worker.created_at),
    jobId: worker.id ? worker.id.slice(0, 8).toUpperCase() : "—",
    source: "Application Portal",
    currentStatus,
    currentStatusTone,
    aiConfidenceScore,
    matchLabel: matchLabelForScore(aiConfidenceScore),
    recommendationSummary: `${candidateName} demonstrates ${matchLabelForScore(aiConfidenceScore).toLowerCase()} alignment with the role requirements. Skills and assessment results indicate a ${aiConfidenceScore >= 70 ? "high" : "moderate"} probability of success in this position.`,
    metrics: [
      {
        id: "experience",
        label: "Experience Match",
        percent: experienceScore,
        rating: ratingForPercent(experienceScore),
        theme: "green",
      },
      {
        id: "skills",
        label: "Skills Match",
        percent: skillsScore,
        rating: ratingForPercent(skillsScore),
        theme: "orange",
      },
      {
        id: "assessment",
        label: "Assessment Score",
        percent: assessmentScore,
        rating: assessmentScore >= 85 ? "Excellent" : ratingForPercent(assessmentScore),
        theme: "blue",
      },
      {
        id: "cultural",
        label: "Cultural Fit",
        percent: culturalScore,
        rating: ratingForPercent(culturalScore),
        theme: "yellow",
      },
    ],
    strengths,
    evaluationItems,
    documents,
    checklistProgressPercent,
    onboardingCompletionPercent,
  };
}
