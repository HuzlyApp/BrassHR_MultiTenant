"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HireStageBoard } from "@/app/admin_recruiter/components/hire-stage/HireStageBoard";
import type { HireStageSidebarProfile } from "@/app/admin_recruiter/components/hire-stage/HireStageSidebar";
import {
  POST_HIRE_UNASSIGNED_MESSAGE,
  PRE_HIRE_UNASSIGNED_MESSAGE,
} from "@/lib/onboarding/assigned-workflow-steps";
import type { CandidateWorkflowPhaseView } from "@/lib/onboarding/candidate-workflow-phase-view";

type HireTab = "pre_hire" | "post_hire";

type ProfilePayload = {
  worker?: {
    first_name?: string | null;
    last_name?: string | null;
    job_role?: string | null;
    status?: string | null;
    status_label?: string | null;
    profile_photo_url?: string | null;
    department?: string | null;
    city?: string | null;
    state?: string | null;
    employment_type?: string | null;
    source?: string | null;
    created_at?: string | null;
  };
  error?: string;
};

function formatAppliedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function profileFromWorker(worker: ProfilePayload["worker"]): HireStageSidebarProfile {
  const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim();
  const location = [worker?.city, worker?.state].filter(Boolean).join(", ") || null;
  return {
    name: name || "Candidate",
    role: worker?.job_role ?? "",
    statusLabel: worker?.status_label ?? worker?.status ?? null,
    photoUrl: worker?.profile_photo_url ?? null,
    workType: worker?.employment_type ?? null,
    department: worker?.department ?? null,
    location,
    source: worker?.source ?? null,
    dateApplied: formatAppliedDate(worker?.created_at),
  };
}

export default function HireJourneyClient({ workerId }: { workerId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") === "post_hire" ? "post_hire" : "pre_hire";

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [view, setView] = useState<CandidateWorkflowPhaseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<HireTab>("pre_hire");

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError(null);
    try {
      const [profileRes, phaseRes] = await Promise.all([
        fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/candidates/${encodeURIComponent(workerId)}/workflow-phases`, {
          cache: "no-store",
        }),
      ]);
      const profileJson = (await profileRes.json()) as ProfilePayload;
      const phaseJson = (await phaseRes.json()) as CandidateWorkflowPhaseView & { error?: string };
      if (!profileRes.ok) throw new Error(profileJson.error || "Failed to load candidate");
      if (!phaseRes.ok) throw new Error(phaseJson.error || "Failed to load hire journey");
      setProfile(profileJson);
      setView(phaseJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hire journey");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postHireVisible = Boolean(view?.postHireVisible);

  useEffect(() => {
    if (loading) return;
    if (requestedTab === "post_hire" && !postHireVisible) {
      setTab("pre_hire");
      router.replace(`/admin_recruiter/candidates/${encodeURIComponent(workerId)}/hire-journey`);
      return;
    }
    setTab(requestedTab);
  }, [loading, postHireVisible, requestedTab, router, workerId]);

  const sidebarProfile = useMemo(() => profileFromWorker(profile?.worker), [profile?.worker]);

  function selectTab(next: HireTab) {
    if (next === "post_hire" && !postHireVisible) return;
    setTab(next);
    const href =
      next === "post_hire"
        ? `/admin_recruiter/candidates/${encodeURIComponent(workerId)}/hire-journey?tab=post_hire`
        : `/admin_recruiter/candidates/${encodeURIComponent(workerId)}/hire-journey`;
    router.replace(href);
  }

  return (
    <div className="admin-recruiter-page-pad bg-[#F5F6F8]">
      <div className="admin-recruiter-content-width space-y-5">
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-full border border-[#E5E7EB] bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Hire phase"
          >
            {(
              [
                { id: "pre_hire" as const, label: "Pre Hire" },
                { id: "post_hire" as const, label: "Post Hire" },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              const locked = item.id === "post_hire" && !postHireVisible;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={locked}
                  title={
                    locked
                      ? "Convert / Approve as Worker to unlock Post-Hire."
                      : undefined
                  }
                  onClick={() => selectTab(item.id)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    active ? "text-white shadow-sm" : "text-[#64748B]"
                  } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
                  style={active ? { backgroundColor: "var(--brand-primary)" } : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "post_hire" ? (
          <HireStageBoard
            workerId={workerId}
            lifecycle="post_hire"
            loading={loading}
            error={error}
            assigned={view?.postHire?.assigned ?? false}
            emptyMessage={POST_HIRE_UNASSIGNED_MESSAGE}
            steps={view?.postHire?.steps ?? []}
            assignment={view?.postHire?.assignment}
            phaseView={view}
            profile={sidebarProfile}
            activationFailed={Boolean(view?.postHireVisible && view.postHireActivationFailed)}
          />
        ) : (
          <HireStageBoard
            workerId={workerId}
            lifecycle="pre_hire"
            loading={loading}
            error={error}
            assigned={view?.preHire?.assigned ?? false}
            emptyMessage={PRE_HIRE_UNASSIGNED_MESSAGE}
            steps={view?.preHire?.steps ?? []}
            assignment={view?.preHire?.assignment}
            phaseView={view}
            profile={sidebarProfile}
            onRequestPostHireTab={() => selectTab("post_hire")}
          />
        )}
      </div>
    </div>
  );
}
