"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type { OnboardingFlowListItem, OnboardingFlowStatus } from "./use-onboarding-flows";
import { FLOWS_QUERY_KEY } from "./use-onboarding-flows";
import { LIBRARIES_QUERY_KEY } from "./use-onboarding-libraries";

export type OnboardingFlowDetail = OnboardingFlowListItem & {
  builderDraft: SerializableWorkflowState;
  createdBy: string | null;
  updatedBy: string | null;
};

const flowDetailKey = (flowId: string) => ["onboarding-flow", flowId] as const;

async function fetchFlow(flowId: string): Promise<OnboardingFlowDetail> {
  const res = await fetch(`/api/admin/onboarding-flows/${flowId}`, await staffFetchInit());
  const data = (await res.json()) as { flow?: OnboardingFlowDetail; error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load flow");
  if (!data.flow) throw new Error("Flow not found");
  return data.flow;
}

export type UpdateFlowInput = {
  name?: string;
  status?: OnboardingFlowStatus;
  libraryId?: string | null;
  builderDraft?: SerializableWorkflowState;
  publish?: boolean;
  saveTemplate?: boolean;
  templateName?: string;
};

export function useOnboardingFlow(flowId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: flowId ? flowDetailKey(flowId) : ["onboarding-flow", "none"],
    queryFn: () => fetchFlow(flowId!),
    enabled: Boolean(flowId),
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateFlowInput) => {
      if (!flowId) throw new Error("No flow selected");
      const res = await fetch(`/api/admin/onboarding-flows/${flowId}`, {
        ...(await staffFetchInit({ "Content-Type": "application/json" })),
        method: "PATCH",
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        flow?: OnboardingFlowDetail;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to update flow");
      return data.flow!;
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(flowDetailKey(flow.id), flow);
      void queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });
    },
  });

  return {
    flow: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateFlow: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
