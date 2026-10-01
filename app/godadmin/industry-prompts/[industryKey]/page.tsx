"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Eye,
  History,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import SuccessModal from "@/app/components/SuccessModal";
import ErrorModal from "@/app/components/ErrorModal";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  INDUSTRY_PROMPT_SUPPORTED_VARIABLES,
  INDUSTRY_PROMPT_VARIANT_LABELS,
  validateIndustryPromptBody,
  type IndustryPromptVariantKey,
  type IndustryPromptVersionDetail,
} from "@/lib/godadmin/industry-prompts";
import { formatEastern } from "@/lib/datetime/eastern";
import EasternLiveClock from "@/app/components/godadmin/EasternLiveClock";

type DetailPayload = {
  detail: {
    industryKey: string;
    industryLabel: string;
    aiPackKey: string;
    aiPackLabel: string;
    sharesPackWith: { key: string; label: string }[];
    variantKey: IndustryPromptVariantKey;
    templateId: string | null;
    active: IndustryPromptVersionDetail | null;
    effectiveSource: "dedicated" | "global_fallback" | "none";
    fallbackActive: IndustryPromptVersionDetail | null;
    versions: IndustryPromptVersionDetail[];
  };
  variants: { key: IndustryPromptVariantKey; label: string }[];
  supportedVariables: { name: string; description: string }[];
};

type EditorTab = "edit" | "preview" | "history";

function eventKindLabel(event: IndustryPromptVersionDetail["eventLabel"]): string {
  switch (event) {
    case "created":
      return "Created";
    case "updated":
      return "Updated";
    case "activated":
      return "Activated";
    case "restored":
      return "Restored";
    case "retired":
      return "Retired";
    case "draft":
      return "Draft";
  }
}

function formatPromptTime(value: string | null | undefined): string {
  return formatEastern(
    value,
    { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    "—"
  );
}

function formatPromptTimeWithKind(
  value: string | null | undefined,
  kind: "created" | "updated" | "activated" | "restored" | "retired"
): string {
  const formatted = formatPromptTime(value);
  if (formatted === "—") return "—";
  const label =
    kind === "created"
      ? "Created"
      : kind === "updated"
        ? "Updated"
        : kind === "activated"
          ? "Activated"
          : kind === "restored"
            ? "Restored"
            : "Retired";
  return `${label} ${formatted}`;
}

export default function IndustryPromptDetailPage() {
  const params = useParams();
  const industryKey = String(params.industryKey ?? "");

  const [variantKey, setVariantKey] = useState<IndustryPromptVariantKey>("quick");
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>("edit");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [baselineSystem, setBaselineSystem] = useState("");
  const [baselineUser, setBaselineUser] = useState("");
  const [responseSchema, setResponseSchema] = useState<Record<string, unknown>>({});
  const [modelConfig, setModelConfig] = useState<Record<string, unknown>>({});

  const [viewingVersion, setViewingVersion] = useState<IndustryPromptVersionDetail | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<IndustryPromptVersionDetail | null>(null);
  const [restoreNote, setRestoreNote] = useState("");

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dirty = systemPrompt !== baselineSystem || userPrompt !== baselineUser;

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const applyEditorFrom = useCallback((version: IndustryPromptVersionDetail | null) => {
    const system = version?.systemPrompt ?? "";
    const user = version?.userPromptTemplate ?? "";
    setSystemPrompt(system);
    setUserPrompt(user);
    setBaselineSystem(system);
    setBaselineUser(user);
    setResponseSchema(version?.responseSchema ?? {});
    setModelConfig(version?.modelConfig ?? {});
    setChangeNote("");
  }, []);

  const load = useCallback(async () => {
    if (!industryKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/godadmin/industry-prompts?industryKey=${encodeURIComponent(industryKey)}&variantKey=${encodeURIComponent(variantKey)}`,
        { cache: "no-store", headers: await authHeaders() }
      );
      const body = (await res.json().catch(() => ({}))) as DetailPayload & { error?: string };
      if (!res.ok) {
        setPayload(null);
        setError(body.error || `Failed to load (${res.status})`);
        return;
      }
      setPayload(body);
      const source =
        body.detail.active ??
        (body.detail.effectiveSource === "global_fallback" ? body.detail.fallbackActive : null);
      applyEditorFrom(source);
    } catch {
      setError("Network error while loading prompt.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [applyEditorFrom, authHeaders, industryKey, variantKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const validation = useMemo(
    () =>
      validateIndustryPromptBody({
        systemPrompt,
        userPromptTemplate: userPrompt,
        variantKey,
      }),
    [systemPrompt, userPrompt, variantKey]
  );

  const supportedVariables =
    payload?.supportedVariables ?? INDUSTRY_PROMPT_SUPPORTED_VARIABLES[variantKey];

  function confirmLeave(): boolean {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Leave this page and discard them?");
  }

  function switchVariant(next: IndustryPromptVariantKey) {
    if (next === variantKey) return;
    if (!confirmLeave()) return;
    setVariantKey(next);
    setTab("edit");
    setViewingVersion(null);
  }

  function cancelEdits() {
    if (!confirmLeave()) return;
    const source =
      payload?.detail.active ??
      (payload?.detail.effectiveSource === "global_fallback"
        ? payload.detail.fallbackActive
        : null);
    applyEditorFrom(source ?? null);
  }

  async function runAction(action: string, extra: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/godadmin/industry-prompts", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(body.error || "Action failed");
        setErrorOpen(true);
        return false;
      }
      return body as { ok?: boolean; versionNumber?: number };
    } catch {
      setErrorMessage("Network error while saving.");
      setErrorOpen(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!validation.ok) {
      setErrorMessage(validation.errors.join(" "));
      setErrorOpen(true);
      return;
    }
    if (!changeNote.trim()) {
      setErrorMessage("Add a short change note before saving.");
      setErrorOpen(true);
      return;
    }
    const result = await runAction("save", {
      industryKey,
      variantKey,
      systemPrompt,
      userPromptTemplate: userPrompt,
      changeNote: changeNote.trim(),
      responseSchema,
      modelConfig,
    });
    if (!result) return;
    setSuccessMessage(
      `Published version ${result.versionNumber ?? ""} for ${payload?.detail.aiPackLabel ?? industryKey}. The analyzer will use it on the next new analysis.`
    );
    setSuccessOpen(true);
    await load();
  }

  async function handleCreate() {
    if (!confirmLeave()) return;
    const result = await runAction("create", { industryKey, variantKey });
    if (!result) return;
    setSuccessMessage(
      `Created dedicated prompt v${result.versionNumber ?? ""} for this industry pack (seeded from Global).`
    );
    setSuccessOpen(true);
    await load();
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    const result = await runAction("restore", {
      industryKey,
      variantKey,
      sourceVersionId: restoreTarget.id,
      changeNote:
        restoreNote.trim() || `Restored from version ${restoreTarget.versionNumber}`,
    });
    if (!result) return;
    setRestoreTarget(null);
    setRestoreNote("");
    setSuccessMessage(
      `Restored v${restoreTarget.versionNumber} as new active version ${result.versionNumber ?? ""}. Prior history was preserved.`
    );
    setSuccessOpen(true);
    setTab("edit");
    await load();
  }

  const detail = payload?.detail ?? null;
  const hasDedicated = Boolean(detail?.active);
  const canCreate = !hasDedicated && detail?.effectiveSource !== "none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/godadmin/industry-prompts"
            onClick={(event) => {
              if (!confirmLeave()) event.preventDefault();
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Industry Prompts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {detail?.industryLabel ?? industryKey}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            AI pack <span className="font-medium text-slate-800">{detail?.aiPackLabel ?? "…"}</span>
            {detail?.sharesPackWith.length
              ? ` · shared with ${detail.sharesPackWith.map((peer) => peer.label).join(", ")}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EasternLiveClock />
          {canCreate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Create dedicated prompt
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(payload?.variants ?? Object.entries(INDUSTRY_PROMPT_VARIANT_LABELS).map(([key, label]) => ({
          key: key as IndustryPromptVariantKey,
          label,
        }))).map((variant) => {
          const active = variant.key === variantKey;
          return (
            <button
              key={variant.key}
              type="button"
              onClick={() => switchVariant(variant.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {variant.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading || !detail ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          {loading ? "Loading prompt…" : "Prompt not found."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active version</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {detail.active
                  ? `v${detail.active.versionNumber}`
                  : detail.fallbackActive
                    ? `Global v${detail.fallbackActive.versionNumber}`
                    : "None"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {detail.active
                  ? formatPromptTimeWithKind(detail.active.publishedAt, "activated")
                  : detail.fallbackActive
                    ? "Using Global fallback until a dedicated prompt is published"
                    : "No published prompt for this step"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last actor</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {detail.active?.actorLabel ?? detail.fallbackActive?.actorLabel ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {detail.active?.changeReason ?? detail.fallbackActive?.changeReason ?? "No change note"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Analyzer source</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {detail.effectiveSource === "dedicated"
                  ? "Dedicated pack prompt"
                  : detail.effectiveSource === "global_fallback"
                    ? "Global fallback"
                    : "Not configured"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Completed analyses keep their historical prompt stamp.
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { id: "edit", label: "Editor", icon: Save },
                    { id: "preview", label: "Preview", icon: Eye },
                    { id: "history", label: "History", icon: History },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      tab === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
              {dirty ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  Unsaved changes
                </span>
              ) : null}
            </div>

            {tab === "edit" ? (
              <div className="space-y-5 p-5">
                {!hasDedicated && detail.fallbackActive ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    Editing the Global fallback content below. Saving will publish a{" "}
                    <strong>dedicated</strong> {detail.aiPackLabel} version for this pack. Or use
                    Create dedicated prompt to seed from Global without edits.
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Change note</span>
                  <input
                    value={changeNote}
                    onChange={(event) => setChangeNote(event.target.value)}
                    placeholder="Why is this prompt changing?"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">System prompt</span>
                  <textarea
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    spellCheck={false}
                    className="mt-1.5 h-[320px] w-full resize-y rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-800">User prompt template</span>
                  <textarea
                    value={userPrompt}
                    onChange={(event) => setUserPrompt(event.target.value)}
                    spellCheck={false}
                    className="mt-1.5 h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">
                    Supported placeholders · {INDUSTRY_PROMPT_VARIANT_LABELS[variantKey]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Use exact <code className="rounded bg-white px-1">{"{{name}}"}</code> tokens.
                    Unknown placeholders are rejected on save; meanings are not rewritten.
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {supportedVariables.map((variable) => (
                      <li
                        key={variable.name}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <code className="text-xs font-semibold text-teal-800">{`{{${variable.name}}}`}</code>
                        <p className="mt-0.5 text-[11px] text-slate-500">{variable.description}</p>
                      </li>
                    ))}
                  </ul>
                  {!validation.ok ? (
                    <p className="mt-3 text-sm text-rose-700">{validation.errors.join(" ")}</p>
                  ) : null}
                  {validation.warnings.map((warning) => (
                    <p key={warning} className="mt-2 text-sm text-amber-700">
                      {warning}
                    </p>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void handleSave()}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Save changes
                  </button>
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={cancelEdits}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {tab === "preview" ? (
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Industry:</span> {detail.industryLabel} (
                    {detail.industryKey})
                  </p>
                  <p>
                    <span className="font-medium">AI pack:</span> {detail.aiPackLabel} (
                    {detail.aiPackKey})
                  </p>
                  <p>
                    <span className="font-medium">Step:</span>{" "}
                    {INDUSTRY_PROMPT_VARIANT_LABELS[variantKey]}
                  </p>
                  <p>
                    <span className="font-medium">Active:</span>{" "}
                    {detail.active
                      ? `v${detail.active.versionNumber} (dedicated)`
                      : detail.fallbackActive
                        ? `Global v${detail.fallbackActive.versionNumber}`
                        : "None"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Saved system prompt</h3>
                  <pre className="mt-2 max-h-[360px] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[12px] leading-5 text-slate-100 whitespace-pre-wrap">
                    {(detail.active ?? detail.fallbackActive)?.systemPrompt || "(empty)"}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Saved user prompt template</h3>
                  <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[12px] leading-5 text-slate-100 whitespace-pre-wrap">
                    {(detail.active ?? detail.fallbackActive)?.userPromptTemplate || "(empty)"}
                  </pre>
                </div>
              </div>
            ) : null}

            {tab === "history" ? (
              <div className="p-5">
                {!detail.versions.length ? (
                  <p className="text-sm text-slate-500">
                    No dedicated versions yet for this pack and step.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="pb-2 pr-4">Version</th>
                          <th className="pb-2 pr-4">Event</th>
                          <th className="pb-2 pr-4">Actor</th>
                          <th className="pb-2 pr-4">When</th>
                          <th className="pb-2 pr-4">Change summary</th>
                          <th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.versions.map((version) => (
                          <tr key={version.id} className="border-t border-slate-100 align-top">
                            <td className="py-3 pr-4 font-medium text-slate-900">
                              v{version.versionNumber}
                              {version.isCurrent ? (
                                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 ring-1 ring-emerald-200">
                                  Active
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 pr-4 text-slate-700">
                              {eventKindLabel(version.eventLabel)}
                            </td>
                            <td className="py-3 pr-4 text-slate-700">
                              {version.actorLabel ?? "—"}
                            </td>
                            <td className="py-3 pr-4 text-xs text-slate-600">
                              {version.publishedAt
                                ? formatPromptTimeWithKind(
                                    version.publishedAt,
                                    version.eventLabel === "restored" ? "restored" : "activated"
                                  )
                                : formatPromptTimeWithKind(version.createdAt, "created")}
                              <div className="mt-0.5 text-slate-400">
                                Updated {formatPromptTime(version.updatedAt)}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {version.changeReason || "—"}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => setViewingVersion(version)}
                                >
                                  View
                                </button>
                                {!version.isCurrent && version.status !== "draft" ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                    onClick={() => {
                                      setRestoreTarget(version);
                                      setRestoreNote(
                                        `Restored from version ${version.versionNumber}`
                                      );
                                    }}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Restore
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </>
      )}

      {viewingVersion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Version {viewingVersion.versionNumber}
                </h2>
                <p className="text-xs text-slate-500">
                  {eventKindLabel(viewingVersion.eventLabel)} ·{" "}
                  {viewingVersion.actorLabel ?? "Unknown actor"} ·{" "}
                  {formatPromptTime(viewingVersion.publishedAt ?? viewingVersion.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingVersion(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <p className="text-sm text-slate-600">{viewingVersion.changeReason || "No change note"}</p>
              <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[12px] leading-5 text-slate-100 whitespace-pre-wrap">
                {viewingVersion.systemPrompt}
              </pre>
              <pre className="overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-[12px] leading-5 text-slate-100 whitespace-pre-wrap">
                {viewingVersion.userPromptTemplate}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {restoreTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Restore version?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This creates a <strong>new</strong> active version from v{restoreTarget.versionNumber}.
              Prior versions stay in history. Completed analyses are not changed.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-800">
              Change note
              <input
                value={restoreNote}
                onChange={(event) => setRestoreNote(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setRestoreTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRestore()}
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Confirm restore
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Prompt updated"
        message={successMessage}
        autoCloseMs={4000}
      />
      <ErrorModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Could not save prompt"
        message={errorMessage}
      />
    </div>
  );
}
