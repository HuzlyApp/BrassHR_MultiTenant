"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import { useEffectiveAdminTenantId } from "@/lib/onboarding/hooks/use-effective-admin-tenant";
import { LIBRARIES_QUERY_KEY } from "@/lib/onboarding/hooks/use-onboarding-libraries";

export type OnboardingFlowStatus = "draft" | "published" | "unpublished";

export type OnboardingFlowListItem = {
  id: string;
  name: string;
  status: OnboardingFlowStatus;
  libraryId: string | null;
  templateId: string | null;
  createdAsBlank: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingFlowLibraryInfo = {
  id: string;
  name: string;
  slug: string;
};

type FlowsResponse = {
  flows: OnboardingFlowListItem[];
  publishedCount: number;
  unpublishedCount: number;
  library: OnboardingFlowLibraryInfo | null;
  tenantId?: string;
};

export const FLOWS_QUERY_KEY = ["onboarding-flows"] as const;

function flowsQueryKey(
  tenantId: string | null,
  libraryId?: string,
  librarySlug?: string,
  status?: "published" | "unpublished"
) {
  return [
    ...FLOWS_QUERY_KEY,
    tenantId ?? "none",
    libraryId ?? "none",
    librarySlug ?? "onboarding",
    status ?? "all",
  ] as const;
}

async function fetchFlows(
  libraryId?: string,
  librarySlug?: string,
  status?: "published" | "unpublished"
): Promise<FlowsResponse> {
  const params = new URLSearchParams();
  if (libraryId) {
    params.set("libraryId", libraryId);
  } else if (librarySlug) {
    params.set("librarySlug", librarySlug);
  } else {
    params.set("librarySlug", "onboarding");
  }
  if (status) params.set("status", status);
  const qs = params.toString();
  const res = await fetch(`/api/admin/onboarding-flows${qs ? `?${qs}` : ""}`, {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const data = (await res.json()) as FlowsResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load onboarding flows");
  return {
    flows: data.flows ?? [],
    publishedCount: data.publishedCount ?? 0,
    unpublishedCount: data.unpublishedCount ?? 0,
    library: data.library ?? null,
    tenantId: data.tenantId,
  };
}

export type CreateFlowInput = {
  name: string;
  libraryId?: string | null;
  templateId?: string | null;
  createAsBlank?: boolean;
  status?: OnboardingFlowStatus;
  employmentType?: string | null;
  professionId?: string | null;
};

export function useOnboardingFlows(opts?: {
  libraryId?: string;
  librarySlug?: string;
  status?: "published" | "unpublished";
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { tenantId: scopeTenantId, isLoading: tenantLoading } = useEffectiveAdminTenantId();
  const libraryId = opts?.libraryId;
  const librarySlug = opts?.librarySlug ?? (libraryId ? undefined : "onboarding");
  const status = opts?.status;
  const enabled = opts?.enabled !== false && Boolean(scopeTenantId) && !tenantLoading;

  const query = useQuery({
    queryKey: flowsQueryKey(scopeTenantId, libraryId, librarySlug, status),
    queryFn: () => fetchFlows(libraryId, librarySlug, status),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    enabled,
  });

  const deleteMutation = useMutation({
    mutationFn: async (flowId: string) => {
      const res = await fetch(`/api/admin/onboarding-flows/${flowId}`, {
        ...(await staffFetchInit()),
        method: "DELETE",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete workflow");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY }),
      ]);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      flowId,
      action,
      libraryId,
    }: {
      flowId: string;
      action: "duplicate" | "unpublish" | "move";
      libraryId?: string;
    }) => {
      const body =
        action === "duplicate"
          ? { duplicate: true }
          : action === "unpublish"
            ? { status: "unpublished" }
            : { libraryId: libraryId?.trim() || null };
      if (action === "move" && !libraryId?.trim()) {
        throw new Error("Select a library to move this workflow into");
      }
      const response = await fetch(`/api/admin/onboarding-flows/${encodeURIComponent(flowId)}`, {
        ...(await staffFetchInit({ "Content-Type": "application/json" })),
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} workflow`);
      return data.flow as OnboardingFlowListItem;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY }),
      ]);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateFlowInput) => {
      const res = await fetch("/api/admin/onboarding-flows", {
        ...(await staffFetchInit({ "Content-Type": "application/json" })),
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { flow?: OnboardingFlowListItem; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to create flow");
      return data.flow!;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY }),
      ]);
    },
  });

  return {
    tenantId: scopeTenantId,
    flows: query.data?.flows ?? [],
    publishedCount: query.data?.publishedCount ?? 0,
    unpublishedCount: query.data?.unpublishedCount ?? 0,
    library: query.data?.library ?? null,
    isLoading: tenantLoading || query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createFlow: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    actOnFlow: actionMutation.mutateAsync,
    deleteFlow: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
