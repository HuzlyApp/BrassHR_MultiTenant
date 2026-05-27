"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import toast from "react-hot-toast";

import { WorkflowBuilder } from "@/app/components/workflow-builder";
import type { WorkflowNodeData, WorkflowState } from "@/app/components/workflow-builder";
import {
  ONBOARDING_WORKFLOW_STEP_LIBRARY,
  buildWorkflowStepLookup,
} from "@/app/components/onboarding/workflow-step-library";
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
  error?: string;
  detail?: string;
  code?: string;
};

export default function TenantOnboardingWorkflowBuilder() {
  const stepLookup = useMemo(() => buildWorkflowStepLookup(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [flowTitle, setFlowTitle] = useState("Worker onboarding");
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("published");
  const [initialNodes, setInitialNodes] = useState<Node<WorkflowNodeData>[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [builderKey, setBuilderKey] = useState(0);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/onboarding/config", {
        cache: "no-store",
        headers: await staffAuthHeaders(),
      });
      const payload = (await res.json()) as BuilderPayload;
      if (!res.ok) {
        throw new Error(payload.detail ?? payload.error ?? "Could not load onboarding builder");
      }

      const config = payload.config;
      if (!config || !payload.tenantId) {
        throw new Error("Onboarding configuration is missing for this tenant.");
      }

      const drafts = mapConfigToDrafts(config);
      const { nodes, edges } = hydrateWorkflowFromStorage(
        payload.builderDraft,
        drafts,
        stepLookup
      );

      setTenantId(payload.tenantId);
      setTenantName(payload.tenantName?.trim() || "Your organization");
      setFlowTitle(payload.flowName?.trim() || "Worker onboarding");
      setPublishStatus(payload.publishStatus === "draft" ? "draft" : "published");
      setInitialNodes(nodes);
      setInitialEdges(edges);
      setBuilderKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [stepLookup]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const persist = async (state: WorkflowState, options: { publish?: boolean; template?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      const builderDraft = serializeWorkflowState(state.nodes, state.edges);
      const res = await fetch("/api/admin/onboarding/config", {
        method: "PUT",
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

      if (options.publish) {
        toast.success("Onboarding flow published for this tenant");
      } else if (options.template) {
        toast.success("Draft saved as template");
      } else {
        toast.success("Draft saved");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading onboarding builder…</p>;
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
          onClick={() => void loadConfig()}
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
        </span>
      </div>

      <WorkflowBuilder
        key={`${tenantId ?? "none"}-${builderKey}`}
        embedded
        title={flowTitle}
        subtitle="Applicant onboarding flow"
        productName="Onboarding Builder"
        brandName={tenantName}
        stepLibrary={ONBOARDING_WORKFLOW_STEP_LIBRARY}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        publishStatusLabel={publishStatus === "published" ? "Published" : "Draft"}
        onSaveAsTemplate={(state) => void persist(state, { template: true })}
        onPreview={() => toast("Preview uses the applicant flow for this tenant")}
        onPublish={(state) => void persist(state, { publish: true })}
        onExportPDF={() => toast("Export PDF coming soon")}
        onAddTrigger={() => toast("Triggers are not configured yet")}
      />
    </div>
  );
}
