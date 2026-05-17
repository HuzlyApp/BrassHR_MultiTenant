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
import { useSearchParams } from "next/navigation";

type Ctx = {
  config: TenantOnboardingConfig | null;
  progress: WorkerOnboardingProgressPayload | null;
  loading: boolean;
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

export default function OnboardingConfigProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const tenantFromUrl = searchParams.get("tenant");
  const [config, setConfig] = useState<TenantOnboardingConfig | null>(null);
  const [progress, setProgress] = useState<WorkerOnboardingProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicantId, setApplicantId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const aid = readApplicantId();
    setApplicantId(aid);

    const search = typeof window !== "undefined" ? window.location.search : "";
    const slug = resolveClientOnboardingTenantSlug(search);

    try {
      if (!slug) {
        setConfig(null);
        setProgress(null);
        return;
      }
      const configUrl = `/api/onboarding/config?slug=${encodeURIComponent(slug)}`;
      const configRes = await fetch(configUrl, { cache: "no-store" });
      if (configRes.ok) {
        const payload = (await configRes.json()) as { config?: TenantOnboardingConfig };
        if (payload.config) setConfig(payload.config);
      }

      if (aid) {
        const progRes = await fetch(
          `/api/onboarding/progress?applicantId=${encodeURIComponent(aid)}`,
          { cache: "no-store" }
        );
        if (progRes.ok) {
          const payload = (await progRes.json()) as { progress?: WorkerOnboardingProgressPayload | null };
          setProgress(payload.progress ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, tenantFromUrl]);

  const updateStepStatus = useCallback(
    async (stepKey: string, status: OnboardingStepStatus, data?: Record<string, unknown>) => {
      const aid = readApplicantId();
      if (!aid) return;
      await fetch("/api/onboarding/progress/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId: aid, stepKey, status, data }),
      });
      await refresh();
    },
    [refresh]
  );

  const maxAllowedStepIndex = useMemo(() => {
    if (!config?.steps.length) return 1;
    const enabled = config.steps.filter((s) => s.is_enabled);
    if (!progress?.steps.length) return 1;

    const statusByStepId = new Map(progress.steps.map((p) => [p.onboarding_step_id, p.status]));
    let max = 1;
    for (let i = 0; i < enabled.length; i++) {
      const st = statusByStepId.get(enabled[i].id);
      if (st === "completed" || st === "skipped") {
        max = Math.max(max, i + 2);
      } else if (st === "in_progress") {
        max = Math.max(max, i + 1);
        break;
      } else {
        max = Math.max(max, i + 1);
        break;
      }
    }
    if (typeof window !== "undefined" && localStorage.getItem("step1ReviewCompleted") === "true") {
      max = Math.max(max, 2);
    }
    return Math.min(max, enabled.length);
  }, [config, progress]);

  const value = useMemo(
    () => ({
      config,
      progress,
      loading,
      applicantId,
      refresh,
      updateStepStatus,
      maxAllowedStepIndex,
    }),
    [config, progress, loading, applicantId, refresh, updateStepStatus, maxAllowedStepIndex]
  );

  return (
    <OnboardingConfigContext.Provider value={value}>{children}</OnboardingConfigContext.Provider>
  );
}
