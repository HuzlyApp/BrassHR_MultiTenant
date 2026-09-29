import type { OnboardingStepStatus } from "@/lib/onboarding/types";

export const STAFF_STEP_ACTIONS = ["complete", "reject", "reopen"] as const;

export type StaffStepAction = (typeof STAFF_STEP_ACTIONS)[number];

/** Stored on `worker_onboarding_step_progress.data.staff_review`. */
export type StaffStepReview = {
  decision: StaffStepAction;
  note: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewedAt: string;
};

export type StaffStepActionEligibility = {
  allowed: boolean;
  ownerLabel: string | null;
  actions: StaffStepAction[];
  reason: string | null;
};

export type StaffStepEmailResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  nextStepTitle?: string | null;
};

export const STAFF_REVIEW_NOTE_MAX_LENGTH = 2000;

const OWNER_LABELS: Record<string, string> = {
  recruiter: "Recruiter",
  recruiter_or_hr: "Recruiter / HR",
  hr: "HR",
  hr_admin: "HR Admin",
  admin: "Admin",
  manager: "Manager",
  hiring_manager: "Hiring Manager",
  facility: "Facility",
  facility_manager: "Facility Manager",
  system: "System",
  internal: "Internal team",
};

export function completionOwnerLabel(owner: string | null | undefined): string {
  const value = String(owner ?? "").trim().toLowerCase();
  if (!value) return "Internal team";
  const known = OWNER_LABELS[value];
  if (known) return known;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => (part === "or" ? "/" : part === "hr" ? "HR" : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

export function staffActionTargetStatus(action: StaffStepAction): OnboardingStepStatus {
  if (action === "complete") return "completed";
  if (action === "reject") return "failed";
  return "pending";
}

export function allowedStaffActions(status: OnboardingStepStatus | string | null | undefined): StaffStepAction[] {
  const value = String(status ?? "pending").trim().toLowerCase();
  if (value === "completed" || value === "skipped") return ["reopen"];
  if (value === "failed") return ["complete", "reopen"];
  return ["complete", "reject"];
}

export function staffActionLabel(action: StaffStepAction): string {
  if (action === "complete") return "Mark complete";
  if (action === "reject") return "Reject";
  return "Reopen";
}

export function staffActionResultMessage(
  action: StaffStepAction,
  email: StaffStepEmailResult | null
): { tone: "success" | "warning"; message: string } {
  if (action === "reject") return { tone: "success", message: "Step rejected. The candidate stays blocked at this step." };
  if (action === "reopen") return { tone: "success", message: "Step reopened. It must be completed again before the candidate can continue." };
  if (!email) return { tone: "success", message: "Step completed. No email was sent to the candidate." };
  if (email.sent) {
    return {
      tone: "success",
      message: email.nextStepTitle
        ? `Step completed. The candidate was emailed a link to continue with "${email.nextStepTitle}".`
        : "Step completed. The candidate was emailed a link to continue.",
    };
  }
  switch (email.reason) {
    case "WAITING_ON_INTERNAL_STEP":
      return {
        tone: "success",
        message: "Step completed. No email sent yet: another internal step must be completed before the candidate can continue.",
      };
    case "NO_NEW_CANDIDATE_STEP":
      return {
        tone: "success",
        message:
          "Step completed. No email sent: this didn't unlock a new step for the candidate to fill in (they may still be working on an earlier step, or have none left).",
      };
    case "APPLICATION_SUBMITTED":
      return {
        tone: "success",
        message: "Step completed. No email sent: the candidate has already submitted their application.",
      };
    case "NO_APPLICANT_EMAIL":
      return { tone: "warning", message: "Step completed, but the candidate has no valid email address, so no email was sent." };
    case "RESEND_NOT_CONFIGURED":
      return { tone: "warning", message: "Step completed, but email sending isn't configured, so no email was sent." };
    case "NO_APP_ORIGIN":
      return { tone: "warning", message: "Step completed, but the app URL couldn't be resolved, so no email was sent." };
    default:
      return {
        tone: "warning",
        message: `Step completed, but the email to the candidate failed${email.reason ? `: ${email.reason}` : "."}`,
      };
  }
}

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function readStaffStepReview(data: unknown): StaffStepReview | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = (data as Record<string, unknown>).staff_review;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const review = raw as Record<string, unknown>;
  const decision = asText(review.decision);
  const reviewedAt = asText(review.reviewed_at);
  if (!decision || !reviewedAt || !(STAFF_STEP_ACTIONS as readonly string[]).includes(decision)) {
    return null;
  }
  return {
    decision: decision as StaffStepAction,
    note: asText(review.note),
    reviewedByUserId: asText(review.reviewed_by_user_id),
    reviewedByName: asText(review.reviewed_by_name),
    reviewedAt,
  };
}
