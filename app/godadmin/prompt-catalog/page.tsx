"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type IndustryRow = {
  key: string;
  label: string;
  aiPackKey: string;
  promptStatus: string;
  isActive: boolean;
};

type VersionRow = {
  id: string;
  template_id: string;
  version_number: number;
  status: string;
  content_hash: string | null;
  published_at: string | null;
  change_reason: string | null;
  effective_from: string | null;
  effective_to: string | null;
  system_prompt: string;
  user_prompt_template: string;
  response_schema: unknown;
  model_config: unknown;
  feature_key: string;
  variant_key: string;
  vertical_key: string;
  tenant_id: string | null;
};

type GateRow = {
  id: string;
  match_type: string;
  match_value: string;
  variant_key: string;
  vertical_key_override: string | null;
  is_active: boolean;
};

type RunRow = {
  id: string;
  tenant_id: string;
  feature_key: string;
  variant_key: string;
  vertical_key: string | null;
  industry_key: string | null;
  status: string;
  error_code: string | null;
  content_hash: string | null;
  created_at: string;
};

export default function PromptCatalogPage() {
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [gates, setGates] = useState<GateRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolveIndustry, setResolveIndustry] = useState("allied_health");
  const [resolveResult, setResolveResult] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [draftSystem, setDraftSystem] = useState("");
  const [draftUser, setDraftUser] = useState("");
  const [draftSchema, setDraftSchema] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/godadmin/prompt-catalog", {
      cache: "no-store",
      headers: await authHeaders(),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load prompt catalog");
      return;
    }
    setIndustries(payload.industries ?? []);
    setVersions(payload.versions ?? []);
    setGates(payload.gates ?? []);
    setRuns(payload.runs ?? []);
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function testResolve() {
    const res = await fetch("/api/godadmin/prompt-catalog", {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "resolve",
        tenantId: runs[0]?.tenant_id ?? "00000000-0000-0000-0000-000000000000",
        industryKey: resolveIndustry,
        featureKey: "candidate_match",
        variantKey: "default",
      }),
    });
    const payload = await res.json();
    setResolveResult(JSON.stringify(payload, null, 2));
  }

  const selected = versions.find((row) => row.id === selectedId) ?? null;
  const selectedEditable = selected?.status === "draft";

  function selectVersion(row: VersionRow) {
    setSelectedId(row.id);
    setChangeReason(row.change_reason ?? "");
    setDraftSystem(row.system_prompt ?? "");
    setDraftUser(row.user_prompt_template ?? "");
    setDraftSchema(JSON.stringify(row.response_schema ?? {}, null, 2));
    setDraftModel(JSON.stringify(row.model_config ?? {}, null, 2));
  }

  async function catalogAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/godadmin/prompt-catalog", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Catalog action failed");
        return;
      }
      await load();
      if (payload.versionId) setSelectedId(String(payload.versionId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Prompt Catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operations-only industry mapping, published prompt versions, client gates, and run history.
          Published and retired bodies cannot be edited.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Industry catalog</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 pr-4">Industry</th>
                <th className="pb-2 pr-4">Industry key</th>
                <th className="pb-2 pr-4">AI pack</th>
                <th className="pb-2">Prompt status</th>
              </tr>
            </thead>
            <tbody>
              {industries.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-800">{row.label}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.key}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.aiPackKey}</td>
                  <td className="py-2 text-slate-600">{row.promptStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Prompt catalog</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 pr-4">Feature</th>
                <th className="pb-2 pr-4">Variant</th>
                <th className="pb-2 pr-4">AI pack</th>
                <th className="pb-2 pr-4">Version</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Effective</th>
                <th className="pb-2">Content hash</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-t border-slate-100 ${selectedId === row.id ? "bg-slate-50" : ""}`}
                  onClick={() => selectVersion(row)}
                >
                  <td className="py-2 pr-4">{row.feature_key}</td>
                  <td className="py-2 pr-4">{row.variant_key}</td>
                  <td className="py-2 pr-4">{row.vertical_key}</td>
                  <td className="py-2 pr-4">{row.version_number}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">
                    {row.effective_from ? new Date(row.effective_from).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 font-mono text-xs">{row.content_hash?.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected ? (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              {selected.feature_key}/{selected.variant_key}/{selected.vertical_key} v{selected.version_number}{" "}
              ({selected.status}
              {selected.tenant_id ? `, tenant ${selected.tenant_id}` : ""})
            </p>
            <label className="block text-sm font-medium text-slate-700">
              Change reason
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                disabled={!selectedEditable && selected.status !== "draft"}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              System prompt
              <textarea
                className="mt-1 h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={draftSystem}
                onChange={(event) => setDraftSystem(event.target.value)}
                readOnly={!selectedEditable}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              User prompt template
              <textarea
                className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={draftUser}
                onChange={(event) => setDraftUser(event.target.value)}
                readOnly={!selectedEditable}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Response schema
              <textarea
                className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={draftSchema}
                onChange={(event) => setDraftSchema(event.target.value)}
                readOnly={!selectedEditable}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Model config
              <textarea
                className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                value={draftModel}
                onChange={(event) => setDraftModel(event.target.value)}
                readOnly={!selectedEditable}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => void catalogAction("create_draft", { sourceVersionId: selected.id })}
              >
                Create draft from this version
              </button>
              {selectedEditable ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => {
                    let responseSchema: unknown = {};
                    let modelConfig: unknown = {};
                    try {
                      responseSchema = JSON.parse(draftSchema || "{}");
                      modelConfig = JSON.parse(draftModel || "{}");
                    } catch {
                      setError("Response schema and model config must be valid JSON.");
                      return;
                    }
                    void catalogAction("save_draft", {
                      versionId: selected.id,
                      systemPrompt: draftSystem,
                      userPromptTemplate: draftUser,
                      responseSchema,
                      modelConfig,
                      changeReason,
                    });
                  }}
                >
                  Save draft
                </button>
              ) : null}
              {selectedEditable ? (
                <button
                  type="button"
                  disabled={busy || !changeReason.trim()}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                  onClick={() =>
                    void catalogAction("publish", { versionId: selected.id, changeReason })
                  }
                >
                  Publish
                </button>
              ) : null}
              {selected.status === "published" ? (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700"
                  onClick={() => void catalogAction("retire", { versionId: selected.id })}
                >
                  Retire
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Select a version to inspect history or create a draft.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Client gates</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {gates.map((gate) => (
            <li key={gate.id}>
              {gate.match_type}={gate.match_value} → {gate.variant_key}
              {gate.vertical_key_override ? ` / ${gate.vertical_key_override}` : ""}{" "}
              {gate.is_active ? "(active)" : "(inactive)"}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Test prompt resolution</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={resolveIndustry}
            onChange={(event) => setResolveIndustry(event.target.value)}
          >
            {industries.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void testResolve()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Resolve
          </button>
        </div>
        {resolveResult ? (
          <pre className="mt-3 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs">{resolveResult}</pre>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Recent prompt runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 pr-4">When</th>
                <th className="pb-2 pr-4">Industry</th>
                <th className="pb-2 pr-4">Pack</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.industry_key}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.vertical_key}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 font-mono text-xs">{row.error_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
