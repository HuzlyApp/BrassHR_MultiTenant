"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { WorkflowBuilder } from "@/app/components/workflow-builder";
import type { StepCategory } from "@/app/components/workflow-builder";
import type { WorkflowNodeData, WorkflowState } from "@/app/components/workflow-builder";
import {
  ONBOARDING_WORKFLOW_STEP_LIBRARY,
  buildWorkflowStepLookup,
  hydrateWorkflowStepLibrary,
} from "@/app/components/onboarding/workflow-step-library";
import type { WorkflowStepLibraryCategory } from "@/lib/onboarding/workflow-step-library-data";
import { mapConfigToDrafts } from "@/lib/onboarding/config-to-drafts";
import { hydrateWorkflowFromStorage } from "@/lib/onboarding/drafts-to-workflow";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import { serializeWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import { supabaseBrowser } from "@/lib/supabase-browser";

async function staffAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type BuilderPayload = {
  config?: TenantOnboardingConfig;
  tenantId?: string;
  tenantName?: string | null;
  flowName?: string;
  publishStatus?: "draft" | "published";
  builderDraft?: unknown;
  builderUpdatedAt?: string | null;
  tenantSlug?: string | null;
  error?: string;
  detail?: string;
  code?: string;
};

type BuilderQueryData = {
  payload: BuilderPayload;
  stepLibrary: StepCategory[];
  initialNodes: Node<WorkflowNodeData>[];
  initialEdges: Edge[];
};

const BUILDER_STALE_TIME_MS = 5 * 60 * 1000;
const BUILDER_GC_TIME_MS = 10 * 60 * 1000;

function logBuilderDiagnostic(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[OnboardingBuilder] ${message}`, details ?? {});
  }
}

async function loadBuilderData(): Promise<BuilderQueryData> {
  const headers = await staffAuthHeaders();
  const [libraryRes, res] = await Promise.all([
    fetch("/api/admin/onboarding-builder/steps-library", { headers }),
    fetch("/api/admin/onboarding-builder", { headers }),
  ]);

  let stepLibrary = ONBOARDING_WORKFLOW_STEP_LIBRARY;

  if (libraryRes.ok) {
    const libraryPayload = (await libraryRes.json()) as {
      categories?: WorkflowStepLibraryCategory[];
    };
    if (libraryPayload.categories?.length) {
      stepLibrary = hydrateWorkflowStepLibrary(libraryPayload.categories);
    }
  } else {
    logBuilderDiagnostic("step library request failed; using bundled library", {
      status: libraryRes.status,
    });
  }

  const payload = (await res.json()) as BuilderPayload;
  if (!res.ok) {
    throw new Error(payload.detail ?? payload.error ?? "Could not load onboarding builder");
  }

  const config = payload.config;
  if (!config || !payload.tenantId) {
    throw new Error("Onboarding configuration is missing for this tenant.");
  }

  const drafts = mapConfigToDrafts(config);
  const stepLookup = buildWorkflowStepLookup(stepLibrary);
  const { nodes, edges } = hydrateWorkflowFromStorage(payload.builderDraft, drafts, stepLookup);

  return {
    payload,
    stepLibrary,
    initialNodes: nodes,
    initialEdges: edges,
  };
}

export default function TenantOnboardingWorkflowBuilder() {
  const queryClient = useQueryClient();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextChange = useRef(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [flowTitle, setFlowTitle] = useState("Worker onboarding");
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("published");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [stepLibrary, setStepLibrary] = useState<StepCategory[]>(ONBOARDING_WORKFLOW_STEP_LIBRARY);
  const [initialNodes, setInitialNodes] = useState<Node<WorkflowNodeData>[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [activeFlowKey, setActiveFlowKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["onboarding-builder", tenantId ?? "effective-tenant", activeFlowKey ?? "active-flow"],
    [activeFlowKey, tenantId]
  );

  const {
    data,
    error: queryError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      logBuilderDiagnostic("fetching builder data", { queryKey });
      return loadBuilderData();
    },
    staleTime: BUILDER_STALE_TIME_MS,
    gcTime: BUILDER_GC_TIME_MS,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!data) return;

    const payload = data.payload;
    const nextTenantId = payload.tenantId ?? null;
    const nextFlowName = payload.flowName?.trim() || "Worker onboarding";
    const nextFlowKey = `${nextTenantId ?? "none"}:${nextFlowName}`;

    logBuilderDiagnostic("applying fetched builder data", {
      tenantId: nextTenantId,
      flowName: payload.flowName,
      builderUpdatedAt: payload.builderUpdatedAt,
      isBackgroundRefresh: !isLoading,
    });

    queryClient.setQueryData(["onboarding-builder", nextTenantId ?? "effective-tenant", nextFlowKey], data);
    setTenantId(nextTenantId);
    setTenantSlug(payload.tenantSlug?.trim() || null);
    setTenantName(payload.tenantName?.trim() || "Your organization");
    setFlowTitle(nextFlowName);
    setPublishStatus(payload.publishStatus === "draft" ? "draft" : "published");
    setUpdatedAt(payload.builderUpdatedAt ?? null);
    setStepLibrary(data.stepLibrary);

    if (activeFlowKey !== nextFlowKey) {
      setInitialNodes(data.initialNodes);
      setInitialEdges(data.initialEdges);
      setActiveFlowKey(nextFlowKey);
      skipNextChange.current = true;
    }
  }, [activeFlowKey, data, isLoading, queryClient]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const persist = useCallback(
    async (
      state: WorkflowState,
      options: { publish?: boolean; template?: boolean; silent?: boolean }
    ) => {
      if (!options.silent) setSaving(true);
      setLocalError(null);
      try {
        const builderDraft = serializeWorkflowState(state.nodes, state.edges);
        const endpoint = options.publish
          ? "/api/admin/onboarding-builder/publish"
          : "/api/admin/onboarding-builder/save";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await staffAuthHeaders()),
          },
          body: JSON.stringify({
            builderDraft,
            flowName: flowTitle,
            publish: options.publish === true,
            saveTemplate: options.template === true,
          }),
        });
        const payload = (await res.json()) as BuilderPayload;
        if (!res.ok) {
          throw new Error(payload.detail ?? payload.error ?? "Save failed");
        }

        if (payload.publishStatus) {
          setPublishStatus(payload.publishStatus);
        }
        if (payload.builderUpdatedAt !== undefined) {
          setUpdatedAt(payload.builderUpdatedAt ?? null);
        }

        if (tenantId) {
          queryClient.setQueryData<BuilderQueryData>(queryKey, (current) =>
            current
              ? {
                  ...current,
                  payload: {
                    ...current.payload,
                    flowName: flowTitle,
                    publishStatus: payload.publishStatus ?? current.payload.publishStatus,
                    builderDraft,
                    builderUpdatedAt:
                      payload.builderUpdatedAt ?? current.payload.builderUpdatedAt ?? null,
                  },
                }
              : current
          );
        }

        if (!options.silent) {
          if (options.publish) {
            toast.success("Onboarding flow published for this tenant");
          } else if (options.template) {
            toast.success("Draft saved as template");
          } else {
            toast.success("Draft saved");
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Save failed";
        setLocalError(message);
        if (!options.silent) toast.error(message);
      } finally {
        if (!options.silent) setSaving(false);
      }
    },
    [flowTitle, queryClient, queryKey, tenantId]
  );

  const handleDraftChange = useCallback(
    (state: WorkflowState) => {
      if (skipNextChange.current) {
        skipNextChange.current = false;
        return;
      }
      setPublishStatus("draft");
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        void persist(state, { silent: true });
      }, 900);
    },
    [persist]
  );

  const toolbarData = useMemo(
    () => ({
      templates: [],
      myFlows: [
        {
          id: tenantId ?? "active-flow",
          name: flowTitle,
          status: publishStatus,
        },
      ],
      library: stepLibrary.map((category) => ({
        id: category.id,
        label: category.label,
        count: category.steps.length,
      })),
      settings: [
        { label: "Tenant", value: tenantName || "Unknown tenant" },
        { label: "Tenant slug", value: tenantSlug ?? "Not set" },
        { label: "Status", value: publishStatus },
        { label: "Last saved", value: updatedAt ? new Date(updatedAt).toLocaleString() : "Not saved yet" },
      ],
    }),
    [flowTitle, publishStatus, stepLibrary, tenantId, tenantName, tenantSlug, updatedAt]
  );

  const error = localError ?? (queryError instanceof Error ? queryError.message : null);
  const hasLoadedBuilder = initialNodes.length > 0 || initialEdges.length > 0 || Boolean(tenantId);

  if (isLoading && !hasLoadedBuilder) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading onboarding builder...
      </div>
    );
  }

  if (error && /tenant/i.test(error)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Select a tenant</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (error && /staff role required/i.test(error)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Recruiter sign-in required</p>
        <p className="mt-1">
          Sign in as a recruiter or admin to edit onboarding.{" "}
          <a href="/signin" className="font-semibold underline">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          Configuring: <strong className="text-slate-900">{tenantName}</strong>
          {tenantId ? (
            <span className="ml-2 font-mono text-xs text-slate-400">{tenantId.slice(0, 8)}…</span>
          ) : null}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
          {publishStatus}
          {saving ? " · saving…" : ""}
          {isFetching && !isLoading ? " · refreshing…" : ""}
        </span>
      </div>

      <WorkflowBuilder
        embedded
        resetKey={activeFlowKey ?? undefined}
        title={flowTitle}
        subtitle="Applicant onboarding flow"
        productName="Onboarding Builder"
        brandName={tenantName}
        stepLibrary={stepLibrary}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        publishStatusLabel={publishStatus === "published" ? "Published" : "Draft"}
        toolbarData={toolbarData}
        onChange={handleDraftChange}
        onSaveAsTemplate={(state) => void persist(state, { template: true })}
        onPreview={() => toast("Preview uses the applicant flow for this tenant")}
        onPublish={(state) => void persist(state, { publish: true })}
        onExportPDF={() => toast("Export PDF coming soon")}
        onAddTrigger={() => toast("Triggers are not configured yet")}
      />
    </div>
  );
}
