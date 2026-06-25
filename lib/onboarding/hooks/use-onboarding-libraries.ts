"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import { useEffectiveAdminTenantId } from "@/lib/onboarding/hooks/use-effective-admin-tenant";

export type OnboardingLibraryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isUncategorized: boolean;
  publishedCount: number;
  unpublishedCount: number;
  createdAt: string;
  updatedAt: string;
};

type LibrariesResponse = {
  libraries?: OnboardingLibraryListItem[];
  tenantId?: string;
  error?: string;
};

export const LIBRARIES_QUERY_KEY = ["onboarding-libraries"] as const;

async function fetchLibraries(): Promise<LibrariesResponse> {
  const res = await fetch("/api/admin/onboarding-libraries", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const data = (await res.json()) as LibrariesResponse;
  if (!res.ok) throw new Error(data.error || "Failed to load libraries");
  return {
    libraries: data.libraries ?? [],
    tenantId: data.tenantId,
  };
}

export function useOnboardingLibraries() {
  const queryClient = useQueryClient();
  const { tenantId: scopeTenantId, isLoading: tenantLoading } = useEffectiveAdminTenantId();

  const query = useQuery({
    queryKey: [...LIBRARIES_QUERY_KEY, scopeTenantId ?? "none"],
    queryFn: fetchLibraries,
    enabled: Boolean(scopeTenantId) && !tenantLoading,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await fetch("/api/admin/onboarding-libraries", {
        ...(await staffFetchInit({ "Content-Type": "application/json" })),
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        library?: OnboardingLibraryListItem;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to create library");
      return data.library!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIBRARIES_QUERY_KEY });
    },
  });

  return {
    tenantId: scopeTenantId,
    libraries: query.data?.libraries ?? [],
    isLoading: tenantLoading || query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createLibrary: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
