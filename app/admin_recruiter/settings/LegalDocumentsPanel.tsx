"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  LEGAL_DOCUMENT_AUDIENCE_LABELS,
  isSystemLegalDocumentKey,
  type LegalDocumentAudience,
} from "@/lib/legal/document-keys";
import { legalHtmlToSections, legalSectionsToHtml } from "@/lib/legal/policy-html";
import { legalDocumentPublicPath } from "@/lib/legal/routes";
import type { LegalDocumentRecord } from "@/lib/legal/types";
import LegalPolicyEditor from "@/app/admin_recruiter/settings/LegalPolicyEditor";

type LoadResponse = {
  tenantName?: string | null;
  documents?: LegalDocumentRecord[];
  error?: string;
  code?: string;
  detail?: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const inputClass =
  "h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]/25 disabled:bg-[#F8FAFC]";
const labelClass = "text-sm font-medium text-[#667085]";

export default function LegalDocumentsPanel({ canEdit = true }: { canEdit?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantMissing, setTenantMissing] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "create">("view");

  const [title, setTitle] = useState("");
  const [documentKey, setDocumentKey] = useState("");
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");
  const [audience, setAudience] = useState<LegalDocumentAudience>("all");
  const [isPublished, setIsPublished] = useState(true);
  const [bodyHtml, setBodyHtml] = useState("");

  const selected = useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId]
  );

  const dirty = mode === "create"
    ? Boolean(title || documentKey || lastUpdatedLabel || bodyHtml || audience !== "all" || !isPublished)
    : Boolean(selected && (title !== selected.title || documentKey !== selected.document_key ||
        lastUpdatedLabel !== (selected.last_updated_label ?? "") || audience !== selected.audience ||
        isPublished !== selected.is_published || bodyHtml !== legalSectionsToHtml(selected.sections ?? [])));

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onNavigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const next = new URL(link.href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (!window.confirm("Discard unsaved policy changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onNavigate, true);
    return () => { window.removeEventListener("beforeunload", onUnload); document.removeEventListener("click", onNavigate, true); };
  }, [dirty]);

  const applyRecord = useCallback((item: LegalDocumentRecord) => {
    setTitle(item.title);
    setDocumentKey(item.document_key);
    setLastUpdatedLabel(item.last_updated_label ?? "");
    setAudience(item.audience);
    setIsPublished(item.is_published);
    setBodyHtml(legalSectionsToHtml(item.sections ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setTenantMissing(false);
    try {
      const res = await fetch("/api/admin/legal-documents", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (payload.code === "TENANT_REQUIRED") {
          setTenantMissing(true);
          setDocuments([]);
          return;
        }
        throw new Error(payload.detail ?? payload.error ?? "Could not load legal documents");
      }
      setTenantName(payload.tenantName ?? null);
      const list = payload.documents ?? [];
      setDocuments(list);
      if (list.length > 0) {
        const keep = list.find((d) => d.id === selectedId) ?? list[0];
        setSelectedId(keep.id);
        setMode("view");
        applyRecord(keep);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [applyRecord, selectedId]);

  useEffect(() => {
    void load();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "view" && selected) applyRecord(selected);
  }, [selectedId, selected, mode, applyRecord]);

  const startCreate = () => {
    if (!canEdit) return;
    if (dirty && !window.confirm("Discard unsaved policy changes?")) return;
    setMode("create");
    setSelectedId(null);
    setTitle("");
    setDocumentKey("");
    setLastUpdatedLabel("");
    setAudience("all");
    setIsPublished(true);
    setBodyHtml("");
  };

  const selectDocument = (id: string) => {
    if (id === selectedId && mode === "view") return;
    if (dirty && !window.confirm("Discard unsaved policy changes?")) return;
    setMode("view");
    setSelectedId(id);
  };

  const save = async () => {
    if (!canEdit) return;
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const nextSections = legalHtmlToSections(bodyHtml);
    if (nextSections.length === 0) {
      toast.error("Add policy content before saving.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/legal-documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            title: title.trim(),
            document_key: documentKey.trim() || undefined,
            last_updated_label: lastUpdatedLabel.trim() || null,
            audience,
            sections: nextSections,
            is_published: isPublished,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.detail ?? payload.error ?? "Create failed");
        toast.success("Policy created.");
        const created = payload.document as LegalDocumentRecord;
        setDocuments((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
        setMode("view");
        setSelectedId(created.id);
        applyRecord(created);
      } else {
        if (!selectedId) return;
        const res = await fetch("/api/admin/legal-documents", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            id: selectedId,
            title: title.trim(),
            last_updated_label: lastUpdatedLabel.trim() || null,
            audience,
            sections: nextSections,
            is_published: isPublished,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.detail ?? payload.error ?? "Save failed");
        toast.success("Policy saved. Public screens will use the updated content.");
        const updated = payload.document as LegalDocumentRecord;
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        applyRecord(updated);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!canEdit || !selected || !isSystemLegalDocumentKey(selected.document_key)) return;
    if (!window.confirm("Reset this system policy to the platform default content?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/legal-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({ action: "reset", document_key: selected.document_key }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail ?? payload.error ?? "Reset failed");
      const updated = payload.document as LegalDocumentRecord;
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      applyRecord(updated);
      toast.success("Restored platform default.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  const removeCustom = async () => {
    if (!canEdit || !selected || selected.is_system) return;
    if (!window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/legal-documents?id=${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail ?? payload.error ?? "Delete failed");
      toast.success("Policy deleted.");
      const next = documents.filter((d) => d.id !== selected.id);
      setDocuments(next);
      if (next[0]) {
        setSelectedId(next[0].id);
        setMode("view");
        applyRecord(next[0]);
      } else {
        setSelectedId(null);
        startCreate();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-48 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="h-72 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
          <div className="h-72 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        </div>
      </div>
    );
  }

  if (tenantMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Tenant required</p>
        <p className="mt-1">
          Select a tenant in the header switcher before managing legal documents.
        </p>
      </div>
    );
  }

  const previewPath =
    mode === "view" && selected ? legalDocumentPublicPath(selected.document_key) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#667085]">
          {tenantName ? (
            <>
              Managing policies for <span className="font-medium text-[#101828]">{tenantName}</span>.
              Changes appear on privacy / terms screens for this tenant.
            </>
          ) : (
            "Manage privacy policies, terms, and custom legal documents for this tenant."
          )}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" />
            Add policy
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#EAECF0] bg-white p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
            Documents
          </p>
          <ul className="space-y-1">
            {documents.map((doc) => {
              const active = mode === "view" && doc.id === selectedId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => selectDocument(doc.id)}
                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                      active
                        ? "bg-[#F2F4F7] text-[#101828]"
                        : "text-[#344054] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#98A2B3]">
                        <span>{doc.is_system ? "System" : "Custom"}</span>
                        <span>·</span>
                        <span>{doc.is_published ? "Published" : "Draft"}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {mode === "create" ? (
              <li>
                <div className="flex items-start gap-2 rounded-xl bg-[#EFF8FF] px-3 py-2.5 text-sm font-medium text-[#175CD3]">
                  <Plus className="mt-0.5 h-4 w-4 shrink-0" />
                  New policy
                </div>
              </li>
            ) : null}
          </ul>
        </aside>

        <section className="rounded-xl border border-[#EAECF0] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAECF0] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#101828]">
                {mode === "create" ? "Add legal policy" : selected?.title ?? "Legal policy"}
              </h2>
              {previewPath ? (
                <a
                  href={previewPath}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                >
                  Open public page
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === "view" && selected?.is_system && canEdit ? (
                <button
                  type="button"
                  onClick={() => void resetToDefault()}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset default
                </button>
              ) : null}
              {mode === "view" && selected && !selected.is_system && canEdit ? (
                <button
                  type="button"
                  onClick={() => void removeCustom()}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#FECDCA] bg-white px-3 text-sm font-medium text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[color:var(--brand-primary)] px-3.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Save"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className={labelClass}>Title</span>
                <input
                  className={inputClass}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Privacy Policy"
                />
              </label>

              <label className="block space-y-1.5">
                <span className={labelClass}>Document key</span>
                <input
                  className={inputClass}
                  value={documentKey}
                  onChange={(e) => setDocumentKey(e.target.value)}
                  disabled={!canEdit || mode === "view"}
                  placeholder="custom_worker_policy"
                />
                <span className="text-xs text-[#98A2B3]">
                  Used in `/legal/your_key`. System keys cannot be changed.
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className={labelClass}>Audience</span>
                <select
                  className={inputClass}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as LegalDocumentAudience)}
                  disabled={!canEdit}
                >
                  {(Object.keys(LEGAL_DOCUMENT_AUDIENCE_LABELS) as LegalDocumentAudience[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {LEGAL_DOCUMENT_AUDIENCE_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className={labelClass}>Last updated label</span>
                <input
                  className={inputClass}
                  value={lastUpdatedLabel}
                  onChange={(e) => setLastUpdatedLabel(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Last updated November 17, 2026"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setIsPublished((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm font-medium text-[#344054] disabled:opacity-60"
                >
                  {isPublished ? (
                    <Eye className="h-4 w-4 text-[#039855]" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-[#667085]" />
                  )}
                  {isPublished ? "Published on public screens" : "Draft (hidden from public screens)"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#101828]">Policy content</h3>
                <p className="text-xs text-[#98A2B3]">
                  Same rich editor as job description — paste, format, and copy.
                </p>
              </div>
              <LegalPolicyEditor
                value={bodyHtml}
                onChange={setBodyHtml}
                disabled={!canEdit}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
