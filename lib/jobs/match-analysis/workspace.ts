export const RECRUITER_DECISIONS = [
  "proceed_to_screening",
  "needs_verification",
  "keep_as_possible",
  "redirect_candidate",
  "do_not_pursue",
] as const;

export type RecruiterDecision = (typeof RECRUITER_DECISIONS)[number];

export const RECRUITER_DECISION_LABELS: Record<RecruiterDecision, string> = {
  proceed_to_screening: "Proceed to Screening",
  needs_verification: "Needs Verification",
  keep_as_possible: "Keep as Possible",
  redirect_candidate: "Redirect Candidate",
  do_not_pursue: "Do Not Pursue for This Job",
};

export const VERIFIED_INFO_CATEGORIES = [
  "license",
  "certification",
  "availability",
  "note",
  "other",
] as const;

export type VerifiedInfoCategory = (typeof VERIFIED_INFO_CATEGORIES)[number];

export const VERIFIED_INFO_CATEGORY_LABELS: Record<VerifiedInfoCategory, string> = {
  license: "License",
  certification: "Certification",
  availability: "Availability",
  note: "Note",
  other: "Other",
};

export const QUALIFICATION_FILTERS = [
  "all",
  "mandatory",
  "preferred",
  "confirmed",
  "needs_verification",
  "blocking",
] as const;

export type QualificationFilter = (typeof QUALIFICATION_FILTERS)[number];

export type QualificationDisplayStatus =
  | "Confirmed"
  | "Needs Verification"
  | "Not Met"
  | "Blocking"
  | "Unknown";

export type QualificationRequirement = {
  id: string;
  requirement_text: string;
  requirement_type: string;
  status: string;
  requirement_outcome: string;
  candidate_evidence: string;
  evidence_source?: string | null;
  impact?: string | null;
  verification_required: boolean;
  confidence: number;
  recruiter_verified: boolean;
  recruiter_note: string | null;
};

export function isRecruiterDecision(value: string | null | undefined): value is RecruiterDecision {
  return Boolean(value && RECRUITER_DECISIONS.includes(value as RecruiterDecision));
}

export function isVerifiedInfoCategory(value: string | null | undefined): value is VerifiedInfoCategory {
  return Boolean(value && VERIFIED_INFO_CATEGORIES.includes(value as VerifiedInfoCategory));
}

export function aiScreeningQuestionKey(priority: number, question: string): string {
  return `${priority}:${question.trim().toLowerCase()}`;
}

export function qualificationDisplayStatus(
  req: Pick<
    QualificationRequirement,
    "status" | "requirement_outcome" | "verification_required" | "recruiter_verified"
  >,
  blockingTexts: string[] = []
): QualificationDisplayStatus {
  if (req.recruiter_verified) return "Confirmed";
  const outcome = String(req.requirement_outcome ?? "").toUpperCase();
  const status = String(req.status ?? "").toUpperCase();
  if (outcome === "CONFLICT" || status === "CONFLICTING") return "Blocking";
  if (req.verification_required || outcome === "VERIFY") return "Needs Verification";
  if (outcome === "NOT_MET") return "Not Met";
  if (outcome === "MET" || status === "CONFIRMED") return "Confirmed";
  if (status === "NOT_FOUND") return "Unknown";
  return "Unknown";
}

export function isBlockingRequirement(
  req: Pick<
    QualificationRequirement,
    "requirement_text" | "requirement_outcome" | "status" | "verification_required" | "recruiter_verified"
  >,
  blockingTexts: string[]
): boolean {
  const display = qualificationDisplayStatus(req, blockingTexts);
  if (display === "Blocking") return true;
  const text = req.requirement_text.trim().toLowerCase();
  return blockingTexts.some((item) => item.trim().toLowerCase() === text || item.toLowerCase().includes(text));
}

export function filterQualificationRequirements(
  requirements: QualificationRequirement[],
  filter: QualificationFilter,
  blockingTexts: string[] = []
): QualificationRequirement[] {
  return requirements.filter((req) => {
    const display = qualificationDisplayStatus(req, blockingTexts);
    switch (filter) {
      case "mandatory":
        return String(req.requirement_type).toUpperCase() === "MANDATORY";
      case "preferred":
        return String(req.requirement_type).toUpperCase() === "PREFERRED";
      case "confirmed":
        return display === "Confirmed";
      case "needs_verification":
        return display === "Needs Verification";
      case "blocking":
        return isBlockingRequirement(req, blockingTexts);
      default:
        return true;
    }
  });
}

export function recruiterActionLabel(req: QualificationRequirement): string {
  if (req.recruiter_verified) return "None";
  const display = qualificationDisplayStatus(req);
  if (display === "Needs Verification" || display === "Unknown") return "Ask candidate";
  if (display === "Not Met" || display === "Blocking") return "Verify or stop";
  return "None";
}

export function formatRecruiterDecision(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  if (isRecruiterDecision(value)) return RECRUITER_DECISION_LABELS[value];
  return value.replace(/_/g, " ");
}
