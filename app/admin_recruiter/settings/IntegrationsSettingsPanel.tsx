"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import IntegrationsApiDocs from "@/app/admin_recruiter/settings/IntegrationsApiDocs";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

function SettingsSectionIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[30px]">
      <h1 className="text-sm font-semibold leading-5 text-black">{title}</h1>
      <p className="text-[10px] leading-[15px] text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function IntegrationsSettingsPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/integrations/api-keys", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load API keys");
      setKeys((payload.keys ?? []) as ApiKeyRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name for this API key");
      return;
    }
    setCreating(true);
    setRevealedKey(null);
    try {
      const response = await fetch("/api/admin/integrations/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create API key");
      const apiKey = String(payload.key?.apiKey ?? "");
      setName("");
      setRevealedKey(apiKey || null);
      toast.success("API key created");
      await loadKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create API key");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!window.confirm("Revoke this API key? Existing integrations using it will stop working.")) {
      return;
    }
    setRevokingId(keyId);
    try {
      const response = await fetch(`/api/admin/integrations/api-keys/${keyId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not revoke API key");
      toast.success("API key revoked");
      await loadKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke API key");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  const activeKeys = keys.filter((key) => !key.revokedAt);
  const revokedKeys = keys.filter((key) => key.revokedAt);

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <SettingsSectionIntro
        title="Integrations"
        subtitle="Create inbound API keys so MSP platforms and resume sources can push jobs and candidates into BrassHR."
      />

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[#F3F4F6] p-2 text-[#012352]">
            <KeyRound className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Inbound API keys</h2>
            <p className="mt-1 text-xs leading-5 text-[#6B7280]">
              Keys authenticate{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">POST /api/v1/jobs</code>,{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">GET /api/v1/jobs/search</code>,{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">POST /api/v1/applicants/resume</code>, and{" "}
              <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">GET /api/v1/applicants/search</code>.
              Send the key as <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">Authorization: Bearer</code>{" "}
              or <code className="rounded bg-[#F3F4F6] px-1 py-0.5 text-[11px]">X-API-Key</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-xs text-[#374151]">
            Key name
            <input
              className={`${inputClassName} mt-1`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. iLabor production"
              maxLength={120}
              disabled={creating}
            />
          </label>
          <button
            type="button"
            onClick={() => void createKey()}
            disabled={creating || !name.trim()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#012352] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {creating ? "Creating…" : "Create API key"}
          </button>
        </div>

        {revealedKey ? (
          <div className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
            <p className="text-xs font-medium text-[#92400E]">
              Copy this key now. It will not be shown again.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 text-xs text-[#111827]">
                {revealedKey}
              </code>
              <button
                type="button"
                onClick={() => void copyKey(revealedKey)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Active keys</h2>
        {loading ? (
          <p className="mt-3 text-xs text-[#6B7280]">Loading…</p>
        ) : activeKeys.length === 0 ? (
          <p className="mt-3 text-xs text-[#6B7280]">No active API keys yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#E5E7EB]">
            {activeKeys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#111827]">{key.name}</p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    {key.keyPrefix}… · Created {formatDate(key.createdAt)} · Last used{" "}
                    {formatDate(key.lastUsedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revokeKey(key.id)}
                  disabled={revokingId === key.id}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#FECACA] px-3 text-sm text-[#B91C1C] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {revokingId === key.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revokedKeys.length > 0 ? (
        <section className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111827]">Revoked keys</h2>
          <ul className="mt-3 divide-y divide-[#E5E7EB]">
            {revokedKeys.map((key) => (
              <li key={key.id} className="py-3">
                <p className="text-sm text-[#6B7280]">{key.name}</p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  {key.keyPrefix}… · Revoked {formatDate(key.revokedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <IntegrationsApiDocs />
    </div>
  );
}
