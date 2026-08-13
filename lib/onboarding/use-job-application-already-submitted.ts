"use client";

import { useEffect, useState } from "react";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";

export type JobApplicationCheckState = boolean | null;

export function useJobApplicationAlreadySubmitted(input: {
  jobToken: string | null;
  tenantSlug: string | null;
  sessionReady: boolean;
  enabled: boolean;
  /** When this changes (e.g. progress.submittedAt), re-check submission state. */
  recheckKey?: string | null;
}): JobApplicationCheckState {
  const [alreadySubmitted, setAlreadySubmitted] = useState<JobApplicationCheckState>(null);

  useEffect(() => {
    if (!input.enabled || !input.sessionReady || !input.jobToken || !input.tenantSlug) {
      setAlreadySubmitted(null);
      return;
    }

    const applicantId =
      typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || "" : "";
    if (!applicantId) {
      setAlreadySubmitted(null);
      return;
    }

    let alive = true;
    setAlreadySubmitted(null);

    void fetch("/api/onboarding/job-application/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicantId,
        tenantSlug: input.tenantSlug,
        jobToken: input.jobToken,
      }),
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as {
          alreadySubmitted?: boolean;
        };
        if (!alive) return;
        if (!res.ok) {
          setAlreadySubmitted(false);
          return;
        }
        setAlreadySubmitted(Boolean(payload.alreadySubmitted));
      })
      .catch(() => {
        if (alive) setAlreadySubmitted(false);
      });

    return () => {
      alive = false;
    };
  }, [
    input.enabled,
    input.jobToken,
    input.sessionReady,
    input.tenantSlug,
    input.recheckKey,
  ]);

  return alreadySubmitted;
}

export function readJobTokenFromSearch(search: string): string | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw.trim()) return null;
  return normalizeJobToken(new URLSearchParams(raw).get("job_token"));
}
