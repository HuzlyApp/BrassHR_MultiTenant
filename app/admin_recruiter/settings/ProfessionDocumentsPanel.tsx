"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  SETTINGS_PROFESSION_DOCUMENT_KINDS,
  professionDocumentKindLabel,
  type ProfessionDocumentKind,
} from "@/lib/professions/profession-documents";

const PROFESSION_QUERY_KEY = "profession";

type DocumentKind = ProfessionDocumentKind;

type DocumentDraft = {
  id: string;
  name: string;
  documentKind: DocumentKind;
  isRequired: boolean;
  hasExpiration: boolean;
  sortOrder: number;
};

type ProfessionRow = {
  id: string;
  name: string;
  catalogKey: string | null;
  industryKey: string | null;
  documents: DocumentDraft[];
};

type CatalogProfessionOption = {
  key: string;
  name: string;
  industryKey: string;
  industryLabel: string | null;
};

type CatalogPayload = {
  canManage: boolean;
  industryKey: string | null;
  industryLabel: string | null;
  professions: ProfessionRow[];
  availableProfessions?: CatalogProfessionOption[];
  error?: string;
};

const fieldClassName =
  "h-9 w-full cursor-pointer appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC]";

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]";

function industryPrefix(label: string | null | undefined): string {
  const parts = (label ?? "PR").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? "P"}${parts[1][0] ?? "R"}`.toUpperCase();
  return (parts[0] ?? "PR").slice(0, 2).toUpperCase();
}

function professionCode(
  profession: ProfessionRow,
  index: number,
  industryLabel: string | null
): string {
  if (profession.catalogKey) {
    return profession.catalogKey.replace(/_/g, "-").toUpperCase();
  }
  return `${industryPrefix(industryLabel)}-${String(index + 1).padStart(3, "0")}`;
}

function readSelectOptions(children: ReactNode): Array<{ value: string; label: string }> {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) return [];
    const label = child.props.children;
    return [
      {
        value: child.props.value == null ? "" : String(child.props.value),
        label: typeof label === "string" || typeof label === "number" ? String(label) : "",
      },
    ];
  });
}

function SelectField({
  label,
  className,
  children,
  value,
  disabled,
  onChange,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  value?: string;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
}) {
  const options = readSelectOptions(children);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const currentValue = value ?? "";
  const display = options.find((option) => option.value === currentValue)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClassName} flex items-center text-left`}
      >
        <span className="truncate">{display}</span>
      </button>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
        aria-hidden
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const selected = option.value === currentValue;
            return (
              <li key={option.value || "__empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange?.({ target: { value: option.value } });
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-[#EFF6FF] ${
                    selected ? "bg-[#DBEAFE] font-medium text-[#0F172A]" : "text-[#0F172A]"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function RequiredCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[5px] border border-[#CBD5E1] bg-white checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirming,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profession-delete-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
      >
        <h3 id="profession-delete-title" className="text-base font-semibold text-[#0F172A]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-lg bg-[#B91C1C] px-4 py-2 text-sm font-medium text-white hover:bg-[#991B1B] disabled:opacity-60"
          >
            {confirming ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProfessionDialog({
  name,
  saving,
  onNameChange,
  onSave,
  onCancel,
}: {
  name: string;
  saving?: boolean;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profession-edit-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
      >
        <h3 id="profession-edit-title" className="text-base font-semibold text-[#0F172A]">
          Edit profession
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#64748B]">
          Update the display name for this profession in your organization.
        </p>
        <label className="mt-4 block">
          <span className="sr-only">Profession name</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={80}
            autoFocus
            aria-label="Profession name"
            className={inputClassName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || name.trim().length === 0}
            className="rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function newDocument(): DocumentDraft {
  return {
    id: `new-${crypto.randomUUID()}`,
    name: "",
    documentKind: "certificate",
    isRequired: true,
    hasExpiration: true,
    sortOrder: 0,
  };
}

function normalizeProfession(row: ProfessionRow): ProfessionRow {
  return {
    ...row,
    catalogKey: row.catalogKey ?? null,
    industryKey: row.industryKey ?? null,
    documents: row.documents.map((doc) => ({
      ...doc,
      hasExpiration: doc.hasExpiration === true,
    })),
  };
}

export default function ProfessionDocumentsPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedProfessionId = searchParams.get(PROFESSION_QUERY_KEY)?.trim() || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [industryLabel, setIndustryLabel] = useState<string | null>(null);
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DocumentDraft[]>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [listExpanded, setListExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [availableProfessions, setAvailableProfessions] = useState<CatalogProfessionOption[]>([]);
  const [selectedCatalogKey, setSelectedCatalogKey] = useState("");
  const [customName, setCustomName] = useState("");
  const [addingProfession, setAddingProfession] = useState(false);
  const [removingProfession, setRemovingProfession] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingProfessionId, setEditingProfessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingProfessionName, setSavingProfessionName] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const documentsPanelRef = useRef<HTMLDivElement>(null);
  const previousSelectedIdRef = useRef<string | null>(null);

  const professionHref = useCallback(
    (professionId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (professionId) params.set(PROFESSION_QUERY_KEY, professionId);
      else params.delete(PROFESSION_QUERY_KEY);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams]
  );

  const applyPayload = useCallback((payload: CatalogPayload) => {
    const rows = (payload.professions ?? []).map(normalizeProfession);
    const nextDrafts: Record<string, DocumentDraft[]> = {};
    const nextSaved: Record<string, string> = {};
    for (const profession of rows) {
      nextDrafts[profession.id] = profession.documents;
      nextSaved[profession.id] = JSON.stringify(profession.documents);
    }
    setCanManage(payload.canManage);
    setIndustryKey(payload.industryKey);
    setIndustryLabel(payload.industryLabel);
    setAvailableProfessions(payload.availableProfessions ?? []);
    setSelectedCatalogKey((current) =>
      (payload.availableProfessions ?? []).some((option) => option.key === current) ? current : ""
    );
    setProfessions(rows);
    setDrafts(nextDrafts);
    setSaved(nextSaved);
  }, []);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/profession-documents");
      const payload = (await response.json()) as CatalogPayload;
      if (!response.ok) throw new Error(payload.error || "Could not load documents");
      applyPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load documents");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!rowMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rowMenuRef.current?.contains(event.target as Node)) setRowMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId]);

  const selectedId =
    requestedProfessionId && professions.some((profession) => profession.id === requestedProfessionId)
      ? requestedProfessionId
      : null;
  const selected = professions.find((profession) => profession.id === selectedId) ?? null;
  const documents = selectedId ? drafts[selectedId] ?? [] : [];
  const dirty = useMemo(() => {
    if (!selectedId) return false;
    return JSON.stringify(drafts[selectedId] ?? []) !== (saved[selectedId] ?? "[]");
  }, [drafts, saved, selectedId]);

  useEffect(() => {
    if (!loading && requestedProfessionId && professions.length > 0 && !selectedId) {
      router.replace(professionHref(null), { scroll: false });
    }
  }, [loading, requestedProfessionId, professions.length, selectedId, router, professionHref]);

  function openEditProfession(profession: ProfessionRow) {
    setEditingProfessionId(profession.id);
    setEditName(profession.name);
    setConfirmRemove(false);
    setRowMenuId(null);
  }

  useEffect(() => {
    if (!selectedId || previousSelectedIdRef.current === selectedId) return;
    previousSelectedIdRef.current = selectedId;
    setConfirmRemove(false);
    setEditingProfessionId(null);
    setRowMenuId(null);
    setListExpanded(false);
    requestAnimationFrame(() => {
      documentsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId]);

  const filteredProfessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return professions;
    return professions.filter((profession) => {
      const code = professionCode(
        profession,
        professions.findIndex((row) => row.id === profession.id),
        industryLabel
      ).toLowerCase();
      return profession.name.toLowerCase().includes(query) || code.includes(query);
    });
  }, [professions, searchQuery, industryLabel]);

  function updateDocument(id: string, patch: Partial<DocumentDraft>) {
    if (!selectedId || !canManage) return;
    setDrafts((current) => ({
      ...current,
      [selectedId]: (current[selectedId] ?? []).map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
    }));
  }

  function discardDirtyDraft() {
    if (!selectedId || !dirty) return;
    const snapshot = saved[selectedId];
    setDrafts((current) => ({
      ...current,
      [selectedId]: snapshot ? (JSON.parse(snapshot) as DocumentDraft[]) : [],
    }));
  }

  function openProfessionDocs(professionId: string) {
    if (professionId === selectedId) {
      setConfirmRemove(false);
      setRowMenuId(null);
      requestAnimationFrame(() => {
        documentsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    if (dirty && !window.confirm("Discard unsaved document changes for this profession?")) return;
    discardDirtyDraft();
    setConfirmRemove(false);
    setRowMenuId(null);
    router.push(professionHref(professionId));
  }

  function clearProfessionDocs() {
    if (dirty && !window.confirm("Discard unsaved document changes for this profession?")) return;
    discardDirtyDraft();
    setConfirmRemove(false);
    setRowMenuId(null);
    setListExpanded(true);
    router.push(professionHref(null));
  }

  async function createProfession(body: { name?: string; catalogKey?: string }) {
    if (!canManage || addingProfession) return;
    if (dirty && !window.confirm("Discard unsaved document changes for this profession?")) return;
    setAddingProfession(true);
    try {
      const response = await fetch("/api/admin/professions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; profession?: { id?: string } };
      if (!response.ok) throw new Error(payload.error || "Could not add profession");
      const createdId = payload.profession?.id?.trim() || null;
      setCustomName("");
      setSelectedCatalogKey("");
      setConfirmRemove(false);
      toast.success("Profession added");
      await load({ silent: true });
      if (createdId) router.push(professionHref(createdId));
      else setListExpanded(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add profession");
    } finally {
      setAddingProfession(false);
    }
  }

  async function addCustomProfession() {
    const name = customName.trim();
    if (!name) return;
    await createProfession({ name });
  }

  async function addCatalogProfession() {
    const catalogKey = selectedCatalogKey.trim();
    if (!catalogKey) return;
    await createProfession({ catalogKey });
  }

  async function saveProfessionName() {
    if (!canManage || !editingProfessionId || savingProfessionName) return;
    const name = editName.trim();
    if (!name) return;
    setSavingProfessionName(true);
    try {
      const response = await fetch(`/api/admin/professions/${editingProfessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not update profession");
      setEditingProfessionId(null);
      setEditName("");
      toast.success("Profession updated");
      await load({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profession");
    } finally {
      setSavingProfessionName(false);
    }
  }

  async function removeProfession() {
    if (!selected || !canManage || removingProfession) return;
    setRemovingProfession(true);
    try {
      const response = await fetch(`/api/admin/professions/${selected.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete profession");
      setConfirmRemove(false);
      setEditingProfessionId(null);
      setRowMenuId(null);
      toast.success("Profession removed");
      await load({ silent: true });
      setListExpanded(true);
      router.replace(professionHref(null), { scroll: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete profession");
    } finally {
      setRemovingProfession(false);
    }
  }

  async function save() {
    if (!selectedId || !canManage || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/profession-documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionId: selectedId,
          documents: documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            documentKind: doc.documentKind,
            isRequired: doc.isRequired,
            hasExpiration: doc.hasExpiration,
          })),
        }),
      });
      const payload = (await response.json()) as { error?: string; documents?: DocumentDraft[] };
      if (!response.ok) throw new Error(payload.error || "Could not save documents");
      const next = (payload.documents ?? []).map((doc) => ({
        ...doc,
        hasExpiration: doc.hasExpiration === true,
      }));
      setDrafts((current) => ({ ...current, [selectedId]: next }));
      setSaved((current) => ({ ...current, [selectedId]: JSON.stringify(next) }));
      setProfessions((current) =>
        current.map((row) => (row.id === selectedId ? { ...row, documents: next } : row))
      );
      toast.success("Upload documents saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save documents");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-10 max-w-xl rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        <div className="h-48 rounded-2xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <p className="max-w-2xl text-sm leading-6 text-[#64748B]">
        Organize professions for your organization
        {industryLabel ? ` in ${industryLabel}` : ""}, then configure the certificates and licenses
        each one requires. Add a custom profession name or pick one from the catalog. Applicants can
        attach up to 5 files per document.
      </p>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : !industryLabel ? (
        <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-sm text-[#64748B]">
          Set this organization’s industry before managing professions.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search professions…"
              aria-label="Search professions"
              className={`${inputClassName} pl-9`}
            />
          </div>

          <div className="relative z-20 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm shadow-slate-900/[0.03]">
            <button
              type="button"
              onClick={() => setListExpanded((current) => !current)}
              className="flex w-full items-center gap-3 rounded-t-2xl px-4 py-3.5 text-left hover:bg-[#F8FAFC]"
              aria-expanded={listExpanded}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#012352]">
                <Briefcase className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#0F172A]">{industryLabel}</span>
                <span className="block text-xs text-[#64748B]">
                  {professions.length} {professions.length === 1 ? "position" : "positions"}
                  {industryKey ? ` · ${industryKey}` : ""}
                </span>
              </span>
              {listExpanded ? (
                <ChevronDown className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              )}
            </button>

            {listExpanded ? (
              <div className="border-t border-[#F1F5F9]">
                {filteredProfessions.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-[#0F172A]">
                      {professions.length === 0 ? "No professions yet" : "No matching professions"}
                    </p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {professions.length === 0
                        ? "Add a custom profession below to start configuring documents."
                        : "Try a different search term."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Code</th>
                          <th className="px-4 py-2.5 font-semibold">Profession</th>
                          <th className="px-4 py-2.5 font-semibold">Documents</th>
                          <th className="px-4 py-2.5 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProfessions.map((profession) => {
                          const index = professions.findIndex((row) => row.id === profession.id);
                          const code = professionCode(profession, index, industryLabel);
                          const active = profession.id === selectedId;
                          const docCount = (drafts[profession.id] ?? profession.documents).length;
                          return (
                            <tr
                              key={profession.id}
                              className={`border-t border-[#F1F5F9] ${
                                active ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]" : "bg-white"
                              }`}
                            >
                              <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{code}</td>
                              <td className="px-4 py-3">
                                <Link
                                  href={professionHref(profession.id)}
                                  onClick={(event) => {
                                    if (dirty && profession.id !== selectedId) {
                                      if (!window.confirm("Discard unsaved document changes for this profession?")) {
                                        event.preventDefault();
                                        return;
                                      }
                                      discardDirtyDraft();
                                    }
                                  }}
                                  className="text-left text-sm font-medium text-[#0F172A] hover:underline"
                                >
                                  {profession.name}
                                </Link>
                                {!profession.catalogKey ? (
                                  <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#64748B]">
                                    Custom
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-[#64748B]">
                                {docCount} {docCount === 1 ? "doc" : "docs"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative flex items-center gap-2" ref={rowMenuId === profession.id ? rowMenuRef : undefined}>
                                  <Link
                                    href={professionHref(profession.id)}
                                    onClick={(event) => {
                                      if (dirty && profession.id !== selectedId) {
                                        if (!window.confirm("Discard unsaved document changes for this profession?")) {
                                          event.preventDefault();
                                          return;
                                        }
                                        discardDirtyDraft();
                                      }
                                    }}
                                    className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                                  >
                                    View docs
                                  </Link>
                                  {canManage ? (
                                    <>
                                      <button
                                        type="button"
                                        aria-label={`More actions for ${profession.name}`}
                                        onClick={() =>
                                          setRowMenuId((current) =>
                                            current === profession.id ? null : profession.id
                                          )
                                        }
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                                      >
                                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                                      </button>
                                      {rowMenuId === profession.id ? (
                                        <div className="absolute right-0 top-9 z-20 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                          <button
                                            type="button"
                                            onClick={() => openEditProfession(profession)}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                                          >
                                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              openProfessionDocs(profession.id);
                                              setConfirmRemove(true);
                                              setRowMenuId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#B91C1C] hover:bg-red-50"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                            Delete
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {canManage ? (
                  <div className="relative z-10 space-y-3 overflow-visible rounded-b-2xl border-t border-[#F1F5F9] bg-[#FCFCFD] px-4 py-4">
                    <form
                      className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void addCustomProfession();
                      }}
                    >
                      <input
                        value={customName}
                        onChange={(event) => setCustomName(event.target.value)}
                        placeholder="Custom profession name"
                        aria-label="Custom profession name"
                        maxLength={80}
                        className={`${inputClassName} sm:max-w-sm`}
                      />
                      <button
                        type="submit"
                        disabled={addingProfession || customName.trim().length === 0}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-sm font-medium text-white disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        {addingProfession ? "Adding…" : "Add profession"}
                      </button>
                    </form>

                    {availableProfessions.length > 0 ? (
                      <form
                        className="relative z-20 flex flex-col gap-2 overflow-visible sm:flex-row sm:items-center"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void addCatalogProfession();
                        }}
                      >
                        <SelectField
                          label="Select catalog profession"
                          value={selectedCatalogKey}
                          onChange={(event) => setSelectedCatalogKey(event.target.value)}
                          className="sm:w-[280px]"
                        >
                          <option value="">Or choose from catalog</option>
                          {availableProfessions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.industryLabel
                                ? `${option.name} (${option.industryLabel})`
                                : option.name}
                            </option>
                          ))}
                        </SelectField>
                        <button
                          type="submit"
                          disabled={addingProfession || selectedCatalogKey.length === 0}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#012352] bg-white px-3 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC] disabled:opacity-50"
                        >
                          Add from catalog
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {selected ? (
            <div
              ref={documentsPanelRef}
              tabIndex={-1}
              className="scroll-mt-4 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm shadow-slate-900/[0.03] outline-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] px-4 py-4 sm:px-5">
                <div className="min-w-0 space-y-3">
                  <button
                    type="button"
                    onClick={clearProfessionDocs}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#012352] hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    All professions
                  </button>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Documents
                    </p>
                    <h2 className="mt-0.5 truncate text-base font-semibold text-[#0F172A]">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-[#64748B]">
                      Certificates, licenses, and other upload requirements
                    </p>
                  </div>
                  {professions.length > 1 ? (
                    <SelectField
                      label="Switch profession"
                      value={selected.id}
                      onChange={(event) => openProfessionDocs(event.target.value)}
                      className="sm:w-[280px]"
                    >
                      {professions.map((profession) => (
                        <option key={profession.id} value={profession.id}>
                          {profession.name}
                        </option>
                      ))}
                    </SelectField>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditProfession(selected)}
                      aria-label={`Edit ${selected.name}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      aria-label={`Delete ${selected.name}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#B91C1C] hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#94A3B8] shadow-sm">
                      <FileText className="h-4 w-4" aria-hidden />
                    </div>
                    <p className="text-sm text-[#64748B]">
                      No certificates or licenses for {selected.name} yet.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 sm:grid-cols-[minmax(0,1fr)_168px_auto_auto_auto] sm:items-center"
                      >
                        <label className="block">
                          <span className="sr-only">Document name</span>
                          <input
                            value={doc.name}
                            disabled={!canManage}
                            onChange={(event) => updateDocument(doc.id, { name: event.target.value })}
                            placeholder="Certificate or license name"
                            className={inputClassName}
                          />
                        </label>
                        <SelectField
                          label="Document type"
                          value={doc.documentKind}
                          disabled={!canManage}
                          onChange={(event) =>
                            updateDocument(doc.id, { documentKind: event.target.value as DocumentKind })
                          }
                        >
                          {/* Settings UI: Certificate / License only (Vaccination & Other hidden). */}
                          {(
                            SETTINGS_PROFESSION_DOCUMENT_KINDS.includes(
                              doc.documentKind as (typeof SETTINGS_PROFESSION_DOCUMENT_KINDS)[number]
                            )
                              ? SETTINGS_PROFESSION_DOCUMENT_KINDS
                              : ([doc.documentKind, ...SETTINGS_PROFESSION_DOCUMENT_KINDS] as const)
                          ).map((kind) => (
                            <option key={kind} value={kind}>
                              {professionDocumentKindLabel(kind)}
                            </option>
                          ))}
                        </SelectField>
                        <label className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
                          <RequiredCheckbox
                            checked={doc.isRequired}
                            disabled={!canManage}
                            onChange={(isRequired) => updateDocument(doc.id, { isRequired })}
                          />
                          {doc.isRequired ? "Required" : "Optional"}
                        </label>
                        <div className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
                          <span className="text-[#64748B]">Expiry</span>
                          <SelectField
                            label={`${doc.name || "Document"} requires expiry date`}
                            value={doc.hasExpiration ? "yes" : "no"}
                            disabled={!canManage}
                            onChange={(event) =>
                              updateDocument(doc.id, { hasExpiration: event.target.value === "yes" })
                            }
                            className="w-[88px]"
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </SelectField>
                        </div>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            if (!selectedId) return;
                            setDrafts((current) => ({
                              ...current,
                              [selectedId]: (current[selectedId] ?? []).filter((row) => row.id !== doc.id),
                            }));
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-white hover:text-[#B91C1C] disabled:opacity-40"
                          aria-label={`Remove ${doc.name || "document"}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-4">
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => {
                      if (!selectedId) return;
                      setDrafts((current) => ({
                        ...current,
                        [selectedId]: [...(current[selectedId] ?? []), newDocument()],
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#012352] hover:underline disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add certificate or license
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || !dirty || saving}
                    onClick={() => void save()}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save documents"}
                  </button>
                </div>
                {!canManage ? (
                  <p className="text-xs text-[#64748B]">Only an administrator can change these documents.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {confirmRemove && selected ? (
        <ConfirmDialog
          title={`Delete ${selected.name}?`}
          message="This removes the profession from your organization and deactivates its document requirements. You can add it again later. Onboarding flows that still use this profession must be updated first."
          confirmLabel="Remove"
          confirming={removingProfession}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => void removeProfession()}
        />
      ) : null}

      {editingProfessionId ? (
        <EditProfessionDialog
          name={editName}
          saving={savingProfessionName}
          onNameChange={setEditName}
          onCancel={() => {
            setEditingProfessionId(null);
            setEditName("");
          }}
          onSave={() => void saveProfessionName()}
        />
      ) : null}
    </section>
  );
}
