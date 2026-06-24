"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { FIELD, FieldLabel } from "./account-form-fields";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

type FirmaSettingsResponse = {
  firma_workspace_id: string | null;
  effective_workspace_id: string | null;
  env_fallback_workspace_id: string | null;
  source: "tenant" | "env" | null;
  firma_workspace_provisioning_status?: string | null;
  firma_workspace_provisioning_error?: string | null;
};

export default function FirmaIntegrationPanel() {
  const { organization, loading, error } = useAccountData();
  const [firmaWorkspaceId, setFirmaWorkspaceId] = useState("");
  const [effectiveWorkspaceId, setEffectiveWorkspaceId] = useState<string | null>(null);
  const [envFallbackId, setEnvFallbackId] = useState<string | null>(null);
  const [source, setSource] = useState<"tenant" | "env" | null>(null);
  const [provisioningStatus, setProvisioningStatus] = useState<string | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      if (!organization?.id) {
        setSettingsLoading(false);
        return;
      }

      setSettingsLoading(true);
      try {
        const res = await fetch("/api/admin/tenant-firma-settings", { cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as FirmaSettingsResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(payload.error || "Failed to load Firma settings");
        }
        if (cancelled) return;
        setFirmaWorkspaceId(payload.firma_workspace_id ?? "");
        setEffectiveWorkspaceId(payload.effective_workspace_id);
        setEnvFallbackId(payload.env_fallback_workspace_id);
        setSource(payload.source);
        setProvisioningStatus(payload.firma_workspace_provisioning_status ?? null);
        setProvisioningError(payload.firma_workspace_provisioning_error ?? null);
      } catch (err) {
        if (!cancelled) {
          setSaveError(err instanceof Error ? err.message : "Failed to load Firma settings");
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const handleProvisionWorkspace = async () => {
    if (!organization?.id) return;

    setProvisioning(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/admin/tenant-firma-settings/provision-workspace", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        firmaProvisioning?: {
          status: string;
          workspaceId?: string | null;
          message?: string | null;
        };
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create Firma workspace");
      }

      const result = payload.firmaProvisioning;
      if (result?.status === "created" && result.workspaceId) {
        setFirmaWorkspaceId(result.workspaceId);
        setEffectiveWorkspaceId(result.workspaceId);
        setSource("tenant");
        setProvisioningStatus("created");
        setProvisioningError(null);
        setSaveSuccess("Firma workspace created successfully.");
      } else if (result?.status === "already_configured" && result.workspaceId) {
        setFirmaWorkspaceId(result.workspaceId);
        setEffectiveWorkspaceId(result.workspaceId);
        setSource("tenant");
        setSaveSuccess("Firma workspace is already configured.");
      } else {
        setProvisioningStatus("failed");
        setProvisioningError(result?.message ?? "Firma workspace creation failed.");
        setSaveError(result?.message ?? "Firma workspace creation failed.");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create Firma workspace");
    } finally {
      setProvisioning(false);
    }
  };

  const showProvisionButton =
    !firmaWorkspaceId.trim() &&
    (provisioningStatus === "failed" || provisioningStatus === "not_configured" || !effectiveWorkspaceId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!organization?.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/admin/tenant-firma-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firma_workspace_id: firmaWorkspaceId.trim() || null,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as FirmaSettingsResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to save Firma settings");
      }

      setFirmaWorkspaceId(payload.firma_workspace_id ?? "");
      setEffectiveWorkspaceId(payload.effective_workspace_id);
      setSource(payload.source);
      setSaveSuccess("Firma workspace settings saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save Firma settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || settingsLoading) {
    return <AccountLoadingSkeleton rows={3} />;
  }

  if (error) {
    return <AccountErrorBanner message={error} />;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Firma E-Signature</h2>
        <p className="mt-1 text-sm text-slate-600">
          Assign a Firma.dev workspace for this organization. Templates and applicant signing requests
          are created in this workspace. Leave blank to use the server&apos;s global{" "}
          <code className="text-xs">FIRMA_WORKSPACE_ID</code> fallback.
        </p>
      </div>

      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      {!effectiveWorkspaceId ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          No Firma workspace is configured for this organization. Set a workspace ID below or ask
          your platform administrator to configure the server{" "}
          <code className="text-xs">FIRMA_WORKSPACE_ID</code> fallback. Template publishing and
          applicant signing will fail until a workspace is available.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="firma-workspace-id">Firma workspace ID</FieldLabel>
          <input
            id="firma-workspace-id"
            className={FIELD}
            value={firmaWorkspaceId}
            onChange={(event) => setFirmaWorkspaceId(event.target.value)}
            placeholder={envFallbackId ? `Uses server fallback (${envFallbackId})` : "Enter Firma workspace ID"}
            autoComplete="off"
          />
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">Effective workspace:</span>{" "}
            {effectiveWorkspaceId ?? "Not configured"}
          </p>
          <p className="mt-1">
            <span className="font-medium">Source:</span>{" "}
            {source === "tenant"
              ? "Organization setting"
              : source === "env"
                ? "Server environment fallback"
                : "None"}
          </p>
        </div>

        {showProvisionButton ? (
          <button
            type="button"
            onClick={() => void handleProvisionWorkspace()}
            disabled={provisioning || saving}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {provisioning ? "Creating Firma workspace…" : "Create Firma workspace"}
          </button>
        ) : null}

        {provisioningError ? (
          <p className="text-sm text-amber-800">{provisioningError}</p>
        ) : null}

        <AccountSaveButton saving={saving} label="Save Firma settings" />
      </form>
    </section>
  );
}
