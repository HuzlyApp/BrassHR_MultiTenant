"use client";

import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import type { WorkflowStepLibraryCategory } from "@/lib/onboarding/workflow-step-library-data";

const STEP_LIBRARY_QUERY_KEY = ["onboarding-step-library"] as const;

async function fetchStepLibrary(): Promise<WorkflowStepLibraryCategory[]> {
  const res = await fetch("/api/admin/onboarding-builder/steps-library", await staffFetchInit());
  const data = (await res.json()) as {
    categories?: WorkflowStepLibraryCategory[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Failed to load step library");
  return data.categories ?? [];
}

export function useOnboardingStepLibrary() {
  const query = useQuery({
    queryKey: STEP_LIBRARY_QUERY_KEY,
    queryFn: fetchStepLibrary,
    staleTime: 60_000,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
