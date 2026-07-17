"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  TenantOnboardingConfig,
  WorkerOnboardingProgressPayload,
  OnboardingStepStatus,
} from "@/lib/onboarding/types";
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";
import { usePathname, useSearchParams } from "next/navigation";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import { readOnboardingPreview } from "@/lib/onboarding/onboarding-preview-storage";
import { computeMaxAllowedStepIndex } from "@/lib/onboarding/tenant-step-navigation";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import { useApplicantSession } from "@/lib/onboarding/applicant-session-context";

export type OnboardingConfigSource = "published" | "draft-preview" | "draft-api" | null;

type Ctx = {
  config: TenantOnboardingConfig | null;
  progress: WorkerOnboardingProgressPayload | null;
  loading: boolean;
  loadingConfig: boolean;
  loadingProgress: boolean;
  progressHydrated: boolean;
  error: string | null;
  source: OnboardingConfigSource;
  isDraftPreview: boolean;
  applicantId: string | null;
  refresh: () => Promise<void>;
  updateStepStatus: (
    stepKey: string,
    status: OnboardingStepStatus,
    data?: Record<string, unknown>
  ) => Promise<void>;
  maxAllowedStepIndex: number;
};

const OnboardingConfigContext = createContext<Ctx | null>(null);

export function useOnboardingConfig() {
  const ctx = useContext(OnboardingConfigContext);
  if (!ctx) {
    throw new Error("useOnboardingConfig must be used within OnboardingConfigProvider");
  }
  return ctx;
}

export function useOnboardingConfigOptional() {
  return useContext(OnboardingConfigContext);
}

function readApplicantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("applicantId")?.trim() || null;
  } catch {
    return null;
  }
}

const PROGRESS_STATUS_RANK: Record<OnboardingStepStatus, number> = {
  pending: 0,
  in_progress: 1,
  failed: 2,
  skipped: 3,
  completed: 4,
};

/** Keep the furthest-along status per step when a stale progress fetch returns. */
function mergeProgressMonotonic(
  prev: WorkerOnboardingProgressPayload,
  incoming: WorkerOnboardingProgressPayload
): WorkerOnboardingProgressPayload {
  const byStepId = new Map(incoming.steps.map((row) => [row.onboarding_step_id, row]));
  for (const row of prev.steps) {
    const next = byStepId.get(row.onboarding_step_id);
    const prevRank = PROGRESS_STATUS_RANK[row.status as OnboardingStepStatus] ?? 0;
    const nextRank = next
      ? PROGRESS_STATUS_RANK[next.status as OnboardingStepStatus] ?? 0
      : -1;
    if (prevRank > nextRank) {
      byStepId.set(row.onboarding_step_id, row);
    }
  }
  return { ...incoming, steps: Array.from(byStepId.values()) };
}

type ConfigPayload = {
  config?: TenantOnboardingConfig;
  error?: string;
  detail?: string;
  code?: string;
  source?: string;
};

export default function OnboardingConfigProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantFromUrl = searchParams.get("tenant");
  const isDraftPreview = searchParams.get("preview") === "draft";
  const { sessionReady, sessionLoading } = useApplicantSession();

  const [config, setConfig] = useState<TenantOnboardingConfig | null>(null);
  const [progress, setProgress] = useState<WorkerOnboardingProgressPayload | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<OnboardingConfigSource>(null);
  const [applicantId, setApplicantId] = useState<string | null>(null);

  const progressFetchSeq = useRef(0);
  const configFetchSeq = useRef(0);

  const fetchProgress = useCallback(async (aid: string, slug: string) => {
    const requestId = ++progressFetchSeq.current;
    setLoadingProgress(true);
    try {
      const progRes = await safeFetchJson<{ progress?: WorkerOnboardingProgressPayload | null }>(
        `/api/onboarding/progress?applicantId=${encodeURIComponent(aid)}&tenant=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      if (requestId !== progressFetchSeq.current) return;
      if (progRes.ok) {
        const incoming = progRes.data.progress ?? null;
        setProgress((prev) => {
          if (!incoming) return null;
          if (!prev) return incoming;
          return mergeProgressMonotonic(prev, incoming);
        });
        setProgressHydrated(true);
      }
    } finally {
      if (requestId === progressFetchSeq.current) {
        setLoadingProgress(false);
      }
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    const requestId = ++configFetchSeq.current;
    setLoadingConfig(true);
    setError(null);

    const search = typeof window !== "undefined" ? window.location.search : "";
    const slug = resolveClientOnboardingTenantSlug(search);

    try {
      if (!slug) {
        if (requestId !== configFetchSeq.current) return;
        setConfig(null);
        setSource(null);
        setError("Select a tenant to load onboarding.");
        return;
      }

      if (isDraftPreview) {
        const preview = readOnboardingPreview(slug);
        if (preview?.config) {
          if (requestId !== configFetchSeq.current) return;
          setConfig(applyApplicantConfigFilters(preview.config));
          setSource("draft-preview");
          return;
        }

        const draftRes = await safeFetchJson<ConfigPayload>(
          `/api/onboarding/preview-config?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        if (requestId !== configFetchSeq.current) return;

        if (draftRes.ok && draftRes.data.config) {
          setConfig(applyApplicantConfigFilters(draftRes.data.config));
          setSource("draft-api");
          return;
        }

        setConfig(null);
        setSource(null);
        const draftMessage = !draftRes.ok
          ? draftRes.data?.error ?? draftRes.error
          : "Draft preview is unavailable.";
        setError(
          draftMessage ||
            "Open preview from the Onboarding Builder so the draft workflow can be loaded."
        );
        return;
      }

      const configRes = await safeFetchJson<ConfigPayload>(
        `/api/onboarding/config?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );

      if (requestId !== configFetchSeq.current) return;

      if (!configRes.ok) {
        setConfig(null);
        setSource(null);
        setError(
          configRes.data?.detail ??
            configRes.data?.error ??
            configRes.error ??
            "Could not load onboarding configuration."
        );
        return;
      }

      if (configRes.data.config) {
        setConfig(applyApplicantConfigFilters(configRes.data.config));
        setSource("published");
      } else {
        setConfig(null);
        setSource(null);
        setError("Onboarding configuration is missing for this tenant.");
      }
    } finally {
      if (requestId === configFetchSeq.current) {
        setLoadingConfig(false);
      }
    }
  }, [isDraftPreview]);

  const refreshProgressOnly = useCallback(async () => {
    const aid = readApplicantId();
    setApplicantId(aid);
    const search = typeof window !== "undefined" ? window.location.search : "";
    const slug = resolveClientOnboardingTenantSlug(search);

    if (isDraftPreview) {
      setProgress(null);
      setProgressHydrated(true);
      setLoadingProgress(false);
      return;
    }

    if (!sessionReady || sessionLoading) {
      setLoadingProgress(true);
      return;
    }

    if (aid && slug) {
      await fetchProgress(aid, slug);
    } else {
      setProgress(null);
      setProgressHydrated(true);
      setLoadingProgress(false);
    }
  }, [fetchProgress, isDraftPreview, sessionReady, sessionLoading]);

  const refresh = useCallback(async () => {
    await refreshConfig();
    await refreshProgressOnly();
  }, [refreshConfig, refreshProgressOnly]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig, tenantFromUrl]);

  useEffect(() => {
    void refreshProgressOnly();
  }, [refreshProgressOnly, tenantFromUrl, sessionReady, sessionLoading]);

  const updateStepStatus = useCallback(
    async (stepKey: string, status: OnboardingStepStatus, data?: Record<string, unknown>) => {
      if (isDraftPreview) return;
      const aid = readApplicantId();
      if (!aid) return;
      const search = typeof window !== "undefined" ? window.location.search : "";
      const slug = resolveClientOnboardingTenantSlug(search);
      const matchedStep =
        config?.steps.find((s) => s.step_key === stepKey) ??
        config?.steps.find((s) => s.step_key.replace(/_\d+$/, "") === stepKey.replace(/_\d+$/, ""));
      const res = await fetch("/api/onboarding/progress/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: aid,
          tenantSlug: slug,
          stepKey,
          stepId: matchedStep?.id,
          status,
          data,
        }),
      });
      const responsePayload = (await res.json().catch(() => ({}))) as {
        error?: string;
        progress?: WorkerOnboardingProgressPayload;
      };
      if (!res.ok) {
        throw new Error(responsePayload.error || "Could not update onboarding progress.");
      }

      if (responsePayload.progress) {
        setProgress(responsePayload.progress);
        setProgressHydrated(true);
        return;
      }

      const step = config?.steps.find((s) => s.step_key === stepKey);
      if (step) {
        setProgress((prev) => {
          if (!prev) return prev;
          const rows = prev.steps.slice();
          const idx = rows.findIndex((row) => row.onboarding_step_id === step.id);
          const nextRow = {
            onboarding_step_id: step.id,
            status,
            completed_at: status === "completed" ? new Date().toISOString() : null,
            data: data ?? rows[idx]?.data ?? {},
          };
          if (idx >= 0) rows[idx] = nextRow;
          else rows.push(nextRow);
          return { ...prev, steps: rows };
        });
        setProgressHydrated(true);
      }
    },
    [isDraftPreview, config?.steps]
  );

  const maxAllowedStepIndex = useMemo(
    () => computeMaxAllowedStepIndex(config, progress, pathname),
    [config, progress, pathname]
  );

  const loading = loadingConfig || loadingProgress || sessionLoading || !sessionReady;

  const value = useMemo(
    () => ({
      config,
      progress,
      loading,
      loadingConfig,
      loadingProgress,
      progressHydrated,
      error,
      source,
      isDraftPreview,
      applicantId,
      refresh,
      updateStepStatus,
      maxAllowedStepIndex,
    }),
    [
      config,
      progress,
      loading,
      loadingConfig,
      loadingProgress,
      progressHydrated,
      error,
      source,
      isDraftPreview,
      applicantId,
      refresh,
      updateStepStatus,
      maxAllowedStepIndex,
    ]
  );

  return (
    <OnboardingConfigContext.Provider value={value}>{children}</OnboardingConfigContext.Provider>
  );
}
