"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export type OnboardingConfigSource = "published" | "draft-preview" | "draft-api" | null;

type Ctx = {
  config: TenantOnboardingConfig | null;
  progress: WorkerOnboardingProgressPayload | null;
  loading: boolean;
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
  const [config, setConfig] = useState<TenantOnboardingConfig | null>(null);
  const [progress, setProgress] = useState<WorkerOnboardingProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<OnboardingConfigSource>(null);
  const [applicantId, setApplicantId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const aid = readApplicantId();
    setApplicantId(aid);
    setError(null);

    const search = typeof window !== "undefined" ? window.location.search : "";
    const slug = resolveClientOnboardingTenantSlug(search);

    try {
      if (!slug) {
        setConfig(null);
        setProgress(null);
        setSource(null);
        setError("Select a tenant to load onboarding.");
        return;
      }

      if (isDraftPreview) {
        const preview = readOnboardingPreview(slug);
        if (preview?.config) {
          setConfig(applyApplicantConfigFilters(preview.config));
          setProgress(null);
          setSource("draft-preview");
          return;
        }

        const draftRes = await safeFetchJson<ConfigPayload>(
          `/api/onboarding/preview-config?slug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        if (draftRes.ok && draftRes.data.config) {
          setConfig(applyApplicantConfigFilters(draftRes.data.config));
          setProgress(null);
          setSource("draft-api");
          return;
        }

        setConfig(null);
        setProgress(null);
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

      if (!configRes.ok) {
        setConfig(null);
        setProgress(null);
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

      if (aid) {
        const progRes = await safeFetchJson<{ progress?: WorkerOnboardingProgressPayload | null }>(
          `/api/onboarding/progress?applicantId=${encodeURIComponent(aid)}&tenant=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );
        if (progRes.ok) {
          setProgress(progRes.data.progress ?? null);
        }
      } else {
        setProgress(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isDraftPreview, searchParams]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, tenantFromUrl, searchParams]);

  const updateStepStatus = useCallback(
    async (stepKey: string, status: OnboardingStepStatus, data?: Record<string, unknown>) => {
      if (isDraftPreview) return;
      const aid = readApplicantId();
      if (!aid) return;
      const search = typeof window !== "undefined" ? window.location.search : "";
      const slug = resolveClientOnboardingTenantSlug(search);
      const res = await fetch("/api/onboarding/progress/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: aid,
          tenantSlug: slug,
          stepKey,
          status,
          data,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not update onboarding progress.");
      }
      await refresh();
    },
    [refresh, isDraftPreview]
  );

  const maxAllowedStepIndex = useMemo(
    () => computeMaxAllowedStepIndex(config, progress, pathname),
    [config, progress, pathname]
  );

  const value = useMemo(
    () => ({
      config,
      progress,
      loading,
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
