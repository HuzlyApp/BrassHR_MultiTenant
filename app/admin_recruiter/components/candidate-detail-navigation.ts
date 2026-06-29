const CANDIDATE_DETAIL_TABS =
  "checklist|profile|attachments|skill-assessments|authorization|activities|facility-assignments|agreement|final-approval|onboard-applicant|history";

const UUID_SEGMENT = "[^/]+";

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
