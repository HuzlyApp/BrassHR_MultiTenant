"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AiAnalysisOverviewClient } from "@/app/admin_recruiter/applications/ai-analysis/AiAnalysisOverviewClient";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";

export function CandidatesAiAnalysisClient({ workerId }: { workerId: string }) {
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = workerId.trim();
    if (!id) {
      setError("Missing candidate.");
      setLoading(false);
      return;
    }

    async function run() {
      try {
        const response = await fetch(
          `/api/admin/job-applications?workerId=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          error?: string;
          applications?: Array<{ id?: string; job_requisition_id?: string | null }>;
        };
        if (!response.ok) throw new Error(payload.error || "Failed to load applications");
        const rows = Array.isArray(payload.applications) ? payload.applications : [];
        const latest = rows[0];
        if (cancelled) return;
        setApplicationId(typeof latest?.id === "string" ? latest.id : null);
        setJobId(typeof latest?.job_requisition_id === "string" ? latest.job_requisition_id : undefined);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load AI analysis.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  if (loading) {
    return (
      <div className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8">
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AI analysis…
        </div>
      </div>
    );
  }

  if (error || !applicationId) {
    return (
      <div className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8">
        <Link
          href="/admin_recruiter/candidates"
          className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
        >
          Back to candidates
        </Link>
        <h1 className={`${CANDIDATES_PAGE_TITLE_CLASS} mt-4`} style={CANDIDATES_PAGE_TITLE_STYLE}>
          AI Analysis Overview
        </h1>
        <p className="mt-4 rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
          {error ||
            "This candidate does not have a job application to analyze yet. Add them to a job, then open AI Analysis."}
        </p>
      </div>
    );
  }

  return (
    <AiAnalysisOverviewClient
      applicationId={applicationId}
      backHref="/admin_recruiter/candidates"
      jobId={jobId}
    />
  );
}
