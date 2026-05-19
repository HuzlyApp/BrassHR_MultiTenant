"use client";

import { useCallback, useEffect, useState } from "react";
import OnboardingStepsBuilder, { createInitialBuilderSteps } from "@/app/components/onboarding/OnboardingStepsBuilder";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

function configToDrafts(config: TenantOnboardingConfig): OnboardingStepDraft[] {
  return config.steps
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((step) => ({
      step_key: step.step_key,
      title: step.title,
      description: step.description ?? "",
      step_type: step.step_type,
      sort_order: step.sort_order,
      is_required: step.is_required,
      is_enabled: step.is_enabled,
      metadata: step.metadata ?? {},
      required_documents: config.requiredDocuments
        .filter((d) => d.onboarding_step_id === step.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => ({
          title: d.title,
          description: d.description ?? "",
          is_required: d.is_required,
          sort_order: d.sort_order,
        })),
    }));
}

type Props = {
  mode: "tenant-signup" | "admin-settings";
  tenantId?: string | null;
  initialSteps?: OnboardingStepDraft[];
  onStepsChange?: (steps: OnboardingStepDraft[]) => void;
};

export default function OnboardingStepsBuilderPanel({
  mode,
  tenantId,
  initialSteps,
  onStepsChange,
}: Props) {
  const [steps, setSteps] = useState<OnboardingStepDraft[]>(
    initialSteps ?? createInitialBuilderSteps()
  );
  const [loading, setLoading] = useState(mode === "admin-settings");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (next: OnboardingStepDraft[]) => {
      setSteps(next);
      onStepsChange?.(next);
    },
    [onStepsChange]
  );

  useEffect(() => {
    if (initialSteps) {
      setSteps(initialSteps);
    }
  }, [initialSteps]);

  useEffect(() => {
    if (mode !== "admin-settings") return;
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/onboarding/config", { cache: "no-store" });
        const payload = (await res.json()) as { config?: TenantOnboardingConfig; error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Could not load onboarding config");
        if (alive && payload.config) {
          const drafts = configToDrafts(payload.config);
          setSteps(drafts);
          onStepsChange?.(drafts);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, onStepsChange]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "tenant-signup") {
        if (!tenantId) throw new Error("Tenant not created yet");
        const res = await fetch("/api/tenant-onboarding/save-onboarding-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, steps }),
        });
        const payload = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Save failed");
        setMessage("Onboarding steps saved.");
        return;
      }

      const res = await fetch("/api/admin/onboarding/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Save failed");
      setMessage("Onboarding configuration saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading onboarding configuration…</p>;
  }

  return (
    <div className="space-y-4">
      <OnboardingStepsBuilder steps={steps} onChange={handleChange} />

      {mode === "admin-settings" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-[#0d9488] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save onboarding steps"}
          </button>
          {message ? <span className="text-sm text-green-700">{message}</span> : null}
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
