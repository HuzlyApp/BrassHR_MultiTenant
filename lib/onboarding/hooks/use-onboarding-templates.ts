"use client";

import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";

export type OnboardingTemplateListItem = {
  id: string;
  name: string;
  folder: "presets" | "saved-templates";
  isPreset: boolean;
  flowName: string | null;
  updatedAt: string;
};

type TemplatesResponse = {
  presets: OnboardingTemplateListItem[];
  savedTemplates: OnboardingTemplateListItem[];
};

const TEMPLATES_QUERY_KEY = ["onboarding-templates"] as const;

async function fetchTemplates(): Promise<TemplatesResponse> {
  const res = await fetch("/api/admin/workflow-templates", await staffFetchInit());
  const data = (await res.json()) as TemplatesResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to load templates");
  return {
    presets: data.presets ?? [],
    savedTemplates: data.savedTemplates ?? [],
  };
}

export function useOnboardingTemplates() {
  const query = useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: fetchTemplates,
    staleTime: 30_000,
  });

  const allTemplates = [...(query.data?.presets ?? []), ...(query.data?.savedTemplates ?? [])];

  const templateOptions = allTemplates.map((t) => ({
    id: t.id,
    label: t.flowName?.trim() || t.name.replace(/\.tpl$/i, ""),
  }));

  return {
    presets: query.data?.presets ?? [],
    savedTemplates: query.data?.savedTemplates ?? [],
    allTemplates,
    templateOptions,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
