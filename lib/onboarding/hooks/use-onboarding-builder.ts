"use client";

import { useOnboardingFlow } from "./use-onboarding-flow";

/**
 * Loads a single onboarding flow for the builder canvas (by flow ID from URL).
 * Tenant-level builder (no flow ID) continues to use the onboarding-builder query.
 */
export function useOnboardingBuilder(flowId: string | null) {
  const { flow, isLoading, isError, error, updateFlow, isUpdating, refetch } =
    useOnboardingFlow(flowId);

  return {
    flow,
    flowName: flow?.name ?? null,
    builderDraft: flow?.builderDraft ?? null,
    publishStatus: flow?.status === "published" ? ("published" as const) : ("draft" as const),
    updatedAt: flow?.updatedAt ?? null,
    isLoading,
    isError,
    error,
    saveFlow: updateFlow,
    isSaving: isUpdating,
    refetch,
  };
}
