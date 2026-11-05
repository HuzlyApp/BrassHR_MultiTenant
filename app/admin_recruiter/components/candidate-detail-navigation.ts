import type { CandidateDetailTab } from "@/lib/onboarding/candidate-detail-tabs";

const CANDIDATE_DETAIL_TABS =
  "checklist|profile|applications|attachments|skill-assessments|authorization|activities|facility-assignments|agreement|final-approval|onboard-applicant|history|ai-analysis|pre-hire|post-hire";

const UUID_SEGMENT = "[^/]+";

export type ParsedCandidateDetailRoute = {
  applicantId: string;
  activeTab: CandidateDetailTab;
};

/** True when the route is any candidate-detail surface (list shell or a specific applicant). */
export function isCandidateDetailPage(pathname: string): boolean {
  const path = (pathname.replace(/\/$/, "") || "/").toLowerCase();

  if (/^\/admin_recruiter\/workers\/[^/]+/.test(path)) {
    return true;
  }

  if (
    new RegExp(
      `^/admin_recruiter/new/(?:${CANDIDATE_DETAIL_TABS})/${UUID_SEGMENT}`
    ).test(path)
  ) {
    return true;
  }

  if (
    new RegExp(
      `^/admin_recruiter/new/profile/(?:resume|notes)/${UUID_SEGMENT}`
    ).test(path)
  ) {
    return true;
  }

  if (new RegExp(`^/admin_recruiter/new/(?:${CANDIDATE_DETAIL_TABS})$`).test(path)) {
    return true;
  }

  if (/^\/admin_recruiter\/new\/profile\/(?:resume|notes)$/.test(path)) {
    return true;
  }

  return false;
}

/**
 * Resolve applicant id + active tab from a candidate-detail pathname.
 * Returns null for list shells or non-detail routes.
 */
export function parseCandidateDetailRoute(
  pathname: string
): ParsedCandidateDetailRoute | null {
  const path = pathname.replace(/\/$/, "") || "/";

  const profileNested = path.match(
    /^\/admin_recruiter\/new\/profile\/(resume|notes)\/([^/]+)/i
  );
  if (profileNested) {
    const segment = profileNested[1].toLowerCase();
    const applicantId = profileNested[2];
    return {
      applicantId,
      activeTab: segment === "notes" ? "Profile" : "Resume",
    };
  }

  const workersProfile = path.match(
    /^\/admin_recruiter\/workers\/([^/]+)\/profile(?:\/(resume|notes))?$/i
  );
  if (workersProfile) {
    const applicantId = workersProfile[1];
    const nested = (workersProfile[2] ?? "").toLowerCase();
    return {
      applicantId,
      activeTab: nested === "resume" ? "Resume" : "Profile",
    };
  }

  const tabMatch = path.match(
    new RegExp(
      `^/admin_recruiter/new/(${CANDIDATE_DETAIL_TABS})/(${UUID_SEGMENT})$`,
      "i"
    )
  );
  if (!tabMatch) return null;

  const segment = tabMatch[1].toLowerCase();
  const applicantId = tabMatch[2];
  const activeTab = candidateDetailTabFromSegment(segment);
  if (!activeTab) return null;
  return { applicantId, activeTab };
}

function candidateDetailTabFromSegment(segment: string): CandidateDetailTab | null {
  switch (segment) {
    case "checklist":
      return "Checklist";
    case "profile":
      return "Profile";
    case "applications":
      return "Applications";
    case "attachments":
      return "Attachments";
    case "skill-assessments":
      return "Skill Assessments";
    case "authorization":
      return "Authorization";
    case "activities":
      return "Activities";
    case "facility-assignments":
      return "Facility Assignments";
    case "agreement":
      return "Agreement";
    case "final-approval":
      return "History";
    case "onboard-applicant":
      return "Onboarded Applicant";
    case "history":
      return "History";
    case "ai-analysis":
      return "AI Analysis";
    case "pre-hire":
      return "Pre-Hire";
    case "post-hire":
      return "Post-Hire";
    default:
      return null;
  }
}

export function getCandidateDetailBackFallback(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";

  if (path.startsWith("/admin_recruiter/workers")) {
    return "/admin_recruiter/workers";
  }

  const profileNestedMatch = path.match(
    /^(\/admin_recruiter\/new\/profile)\/(?:resume|notes)\/([^/]+)/
  );
  if (profileNestedMatch) {
    return `${profileNestedMatch[1]}/${profileNestedMatch[2]}`;
  }

  return "/admin_recruiter/new";
}

export function navigateCandidateDetailBack(
  router: { back: () => void; push: (href: string) => void },
  pathname: string
): void {
  const fallback = getCandidateDetailBackFallback(pathname);

  if (typeof window !== "undefined") {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      router.back();
      return;
    }
  }

  router.push(fallback);
}
