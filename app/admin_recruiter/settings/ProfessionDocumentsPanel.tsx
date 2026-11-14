"use client";

import { Children, isValidElement, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import AssessmentSettingsPanel from "@/app/admin_recruiter/settings/AssessmentSettingsPanel";
import AddIndustryModal, {
  IndustryIconBadge,
  type AddIndustryFormValue,
} from "@/app/admin_recruiter/settings/AddIndustryModal";
import AddCustomProfessionModal, {
  type AddCustomProfessionFormValue,
  type AssessmentOption,
} from "@/app/admin_recruiter/settings/AddCustomProfessionModal";
import { activeUserFacingIndustries } from "@/lib/ai-catalog/industry-catalog";
import { normalizeSkillAssessmentCatalog } from "@/lib/skill-assessment/catalog";
import type { SkillAssessmentCatalog } from "@/lib/skill-assessment/types";
import {
  SETTINGS_PROFESSION_DOCUMENT_KINDS,
  professionDocumentKindLabel,
  type ProfessionDocumentKind,
} from "@/lib/professions/profession-documents";

type IndustryMeta = {
  description: string;
  iconId: string | null;
};

const PROFESSION_QUERY_KEY = "profession";
const PROFESSION_LIST_HREF = "/admin_recruiter/settings/profession";

export function professionDetailHref(professionId: string): string {
  return `${PROFESSION_LIST_HREF}/${encodeURIComponent(professionId)}`;
}

type ProfessionDocumentsPanelProps = {
  /** When set, render the dedicated profession detail page (docs + assessment). */
  detailProfessionId?: string | null;
};

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

type IndustryOption = {
  key: string;
  label: string;
  isPrimary?: boolean;
};

type CatalogPayload = {
  canManage: boolean;
  industryKey: string | null;
  industryLabel: string | null;
  industries?: IndustryOption[];
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

const INDUSTRY_TAGLINES: Record<string, string> = {
  healthcare: "Simplify healthcare recruitment and staff placement.",
  home_care: "Staff home care and home health roles with the right credentials.",
  allied_health: "Place allied health professionals with clear role requirements.",
  senior_care: "Hire for senior care and assisted living with confidence.",
  hospitality: "Fill hospitality and food service roles faster.",
  retail: "Staff retail and convenience store positions consistently.",
  technology: "Hire and place technology talent with confidence.",
  trades: "Source construction and trades professionals for every job site.",
  cleaning: "Organize cleaning and janitorial hiring requirements.",
  childcare: "Support education and childcare staffing workflows.",
  nonprofit: "Manage nonprofit and community organization roles.",
  warehouse: "Staff warehouse, manufacturing, and distribution teams.",
  transportation: "Hire transportation and logistics talent at scale.",
  professional: "Organize professional services roles and credentials.",
  beauty: "Staff beauty, salon, and spa positions.",
  fitness: "Hire for fitness, wellness, and gym roles.",
  other: "Organize custom industries and their positions.",
};

function industryTagline(key: string, label: string): string {
  return INDUSTRY_TAGLINES[key] ?? `Organize ${label} roles and manage their positions.`;
}

function industryDescription(key: string, label: string): string {
  return (
    INDUSTRY_TAGLINES[key] ??
    `Manage ${label} professions, linked assessments, and required documents for your hiring workflows.`
  );
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
  dropUp = false,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  value?: string;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
  /** Open the menu above the field (avoids clipping at accordion bottoms). */
  dropUp?: boolean;
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
          className={`absolute z-50 max-h-60 w-full overflow-auto rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg ${
            dropUp ? "bottom-[calc(100%+4px)]" : "mt-1 top-full"
          }`}
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
            {confirming ? "Removingâ€¦" : confirmLabel}
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
            {saving ? "Savingâ€¦" : "Save"}
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

function settingsDocumentKind(
  kind: DocumentKind
): (typeof SETTINGS_PROFESSION_DOCUMENT_KINDS)[number] {
  return kind === "license" ? "license" : "certificate";
}

function normalizeProfession(row: ProfessionRow): ProfessionRow {
  return {
    ...row,
    catalogKey: row.catalogKey ?? null,
    industryKey: row.industryKey ?? null,
    documents: row.documents.map((doc) => ({
      ...doc,
      // Settings UI only supports Certificate / License (hide Other / Vaccination).
      documentKind: settingsDocumentKind(doc.documentKind),
      hasExpiration: doc.hasExpiration === true,
    })),
  };
}

export default function ProfessionDocumentsPanel({
  detailProfessionId = null,
}: ProfessionDocumentsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProfessionId = searchParams.get(PROFESSION_QUERY_KEY)?.trim() || null;
  const requestedProfessionId = detailProfessionId?.trim() || null;
  const isDetailView = Boolean(requestedProfessionId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [industryLabel, setIndustryLabel] = useState<string | null>(null);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DocumentDraft[]>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [expandedByIndustry, setExpandedByIndustry] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustryKey, setSelectedIndustryKey] = useState<string | null>(null);
  const [industryFilterKey, setIndustryFilterKey] = useState<string>("all");
  const [addIndustryOpen, setAddIndustryOpen] = useState(false);
  const [editIndustryKey, setEditIndustryKey] = useState<string | null>(null);
  const [creatingIndustry, setCreatingIndustry] = useState(false);
  const [industryMetaByKey, setIndustryMetaByKey] = useState<Record<string, IndustryMeta>>({});
  const [assessmentLabelByProfession, setAssessmentLabelByProfession] = useState<
    Record<string, string>
  >({});
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [assessmentDraft, setAssessmentDraft] = useState<SkillAssessmentCatalog | null>(null);
  const [customProfessionIndustryKey, setCustomProfessionIndustryKey] = useState<string | null>(
    null
  );
  const [customProfessionPendingForIndustryCreate, setCustomProfessionPendingForIndustryCreate] =
    useState(false);
  const [extraCustomNamesForIndustryCreate, setExtraCustomNamesForIndustryCreate] = useState<
    string[]
  >([]);
  const [pendingCustomAssessmentByName, setPendingCustomAssessmentByName] = useState<
    Record<string, string>
  >({});
  const [pendingDeleteProfession, setPendingDeleteProfession] = useState<ProfessionRow | null>(null);

  const [availableProfessions, setAvailableProfessions] = useState<CatalogProfessionOption[]>([]);
  const [selectedCatalogKeyByIndustry, setSelectedCatalogKeyByIndustry] = useState<
    Record<string, string>
  >({});
  const [customNameByIndustry, setCustomNameByIndustry] = useState<Record<string, string>>({});
  const [addingProfession, setAddingProfession] = useState(false);
  const [addingIndustryKey, setAddingIndustryKey] = useState<string | null>(null);
  const [removingProfession, setRemovingProfession] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingProfessionId, setEditingProfessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingProfessionName, setSavingProfessionName] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [industryMenuKey, setIndustryMenuKey] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const industryMenuRef = useRef<HTMLDivElement>(null);
  const documentsPanelRef = useRef<HTMLDivElement>(null);
  const previousSelectedIdRef = useRef<string | null>(null);

  /** Legacy `?profession=` links on the list page → dedicated detail route. */
  useEffect(() => {
    if (isDetailView || !queryProfessionId) return;
    router.replace(professionDetailHref(queryProfessionId));
  }, [isDetailView, queryProfessionId, router]);

  const applyPayload = useCallback((payload: CatalogPayload) => {
    const rows = (payload.professions ?? []).map(normalizeProfession);
    const nextDrafts: Record<string, DocumentDraft[]> = {};
    const nextSaved: Record<string, string> = {};
    for (const profession of rows) {
      nextDrafts[profession.id] = profession.documents;
      nextSaved[profession.id] = JSON.stringify(profession.documents);
    }
    const nextIndustries =
      payload.industries && payload.industries.length > 0
        ? payload.industries
        : payload.industryKey
          ? [
              {
                key: payload.industryKey,
                label: payload.industryLabel ?? payload.industryKey,
                isPrimary: true,
              },
            ]
          : [];
    setCanManage(payload.canManage);
    setIndustryKey(payload.industryKey);
    setIndustryLabel(payload.industryLabel);
    setIndustries(nextIndustries);
    setExpandedByIndustry((current) => {
      const next: Record<string, boolean> = {};
      for (const industry of nextIndustries) {
        next[industry.key] = current[industry.key] ?? false;
      }
      return next;
    });
    setSelectedIndustryKey((current) => {
      if (current && nextIndustries.some((row) => row.key === current)) return current;
      return nextIndustries[0]?.key ?? null;
    });
    setAvailableProfessions(payload.availableProfessions ?? []);
    setSelectedCatalogKeyByIndustry((current) => {
      const next: Record<string, string> = {};
      for (const industry of nextIndustries) {
        const value = current[industry.key] ?? "";
        next[industry.key] = (payload.availableProfessions ?? []).some(
          (option) => option.key === value && option.industryKey === industry.key
        )
          ? value
          : "";
      }
      return next;
    });
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
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/assessment-settings", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          settings?: { draft?: unknown };
        };
        if (!response.ok || cancelled) return;
        const draft = normalizeSkillAssessmentCatalog(payload.settings?.draft);
        const labels: Record<string, string> = {};
        const options: AssessmentOption[] = [];
        const seenNames = new Set<string>();
        for (const category of draft.categories) {
          const professionId = category.professionId?.trim();
          const name = category.name?.trim();
          if (!name) continue;
          if (professionId && !labels[professionId]) labels[professionId] = name;
          // Offer shared (null profession) templates plus unique category names for the picker.
          if (!professionId && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            options.push({ id: category.id, name });
          }
        }
        // Fallback: if no shared templates, still show category names once each.
        if (options.length === 0) {
          for (const category of draft.categories) {
            const name = category.name?.trim();
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());
            options.push({ id: category.id, name });
          }
        }
        if (!cancelled) {
          setAssessmentDraft(draft);
          setAssessmentLabelByProfession(labels);
          setAssessmentOptions(options);
        }
      } catch {
        /* linked assessment column stays empty when unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rowMenuId && !industryMenuKey) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
        setRowMenuId(null);
      }
      if (industryMenuRef.current && !industryMenuRef.current.contains(event.target as Node)) {
        setIndustryMenuKey(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId, industryMenuKey]);

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
    if (!loading && isDetailView && professions.length > 0 && !selectedId) {
      router.replace(PROFESSION_LIST_HREF);
    }
  }, [loading, isDetailView, professions.length, selectedId, router]);

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
    const selectedIndustry = professions.find((row) => row.id === selectedId)?.industryKey;
    if (selectedIndustry) {
      setExpandedByIndustry((current) => ({ ...current, [selectedIndustry]: false }));
    }
    requestAnimationFrame(() => {
      documentsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedId, professions]);

  const professionsByIndustry = useMemo(() => {
    const groups: Record<string, ProfessionRow[]> = {};
    for (const industry of industries) {
      groups[industry.key] = [];
    }
    for (const profession of professions) {
      const key = profession.industryKey || industryKey || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(profession);
    }
    return groups;
  }, [professions, industries, industryKey]);

  const filteredProfessionsByIndustry = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return professionsByIndustry;
    const groups: Record<string, ProfessionRow[]> = {};
    for (const [key, rows] of Object.entries(professionsByIndustry)) {
      groups[key] = rows.filter((profession) => {
        const index = professions.findIndex((row) => row.id === profession.id);
        const industry = industries.find((row) => row.key === key);
        const code = professionCode(profession, index, industry?.label ?? null).toLowerCase();
        return (
          profession.name.toLowerCase().includes(query) ||
          code.includes(query) ||
          (industry?.label ?? "").toLowerCase().includes(query)
        );
      });
    }
    return groups;
  }, [professionsByIndustry, searchQuery, professions, industries]);

  const visibleIndustries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return industries.filter((industry) => {
      if (industryFilterKey !== "all" && industry.key !== industryFilterKey) return false;
      if (!query) return true;
      if (industry.label.toLowerCase().includes(query) || industry.key.toLowerCase().includes(query)) {
        return true;
      }
      return (filteredProfessionsByIndustry[industry.key] ?? []).length > 0;
    });
  }, [industries, industryFilterKey, searchQuery, filteredProfessionsByIndustry]);

  const addableIndustries = useMemo(() => {
    const selected = new Set(industries.map((row) => row.key));
    return activeUserFacingIndustries()
      .filter((entry) => !selected.has(entry.key))
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
      }));
  }, [industries]);

  const selectedIndustry =
    industries.find((row) => row.key === selectedIndustryKey) ?? industries[0] ?? null;
  const selectedIndustryProfessions = selectedIndustry
    ? professionsByIndustry[selectedIndustry.key] ?? []
    : [];

  async function addIndustry(industryToAdd: string, options?: { silentToast?: boolean }) {
    if (!canManage || addingIndustryKey) return false;
    setAddingIndustryKey(industryToAdd);
    try {
      const response = await fetch("/api/admin/tenant-industries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industryKey: industryToAdd }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        alreadyAdded?: boolean;
        industryLabel?: string | null;
      };
      if (!response.ok) throw new Error(payload.error || "Could not add industry");
      if (!options?.silentToast) {
        toast.success(
          payload.alreadyAdded
            ? `${payload.industryLabel ?? "Industry"} is already added`
            : `${payload.industryLabel ?? "Industry"} added`
        );
      }
      setSearchQuery("");
      await load({ silent: true });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add industry");
      return false;
    } finally {
      setAddingIndustryKey(null);
    }
  }

  async function createProfessionQuiet(body: {
    name?: string;
    catalogKey?: string;
    industryKey: string;
  }) {
    const response = await fetch("/api/admin/professions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not add profession");
  }

  async function createIndustryFromModal(value: AddIndustryFormValue) {
    if (!canManage || creatingIndustry) return;
    setCreatingIndustry(true);
    try {
      const ok = await addIndustry(value.industryKey, { silentToast: true });
      if (!ok) return;

      setIndustryMetaByKey((current) => ({
        ...current,
        [value.industryKey]: {
          description: value.description,
          iconId: value.iconId,
        },
      }));

      for (const catalogKey of value.catalogKeys) {
        await createProfessionQuiet({
          catalogKey,
          industryKey: value.industryKey,
        });
      }
      for (const name of value.customNames) {
        const response = await fetch("/api/admin/professions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, industryKey: value.industryKey }),
        });
        const payload = (await response.json()) as { error?: string; profession?: { id?: string } };
        if (!response.ok) throw new Error(payload.error || "Could not add profession");
        const createdId = payload.profession?.id?.trim() || null;
        const assessmentId = pendingCustomAssessmentByName[name];
        if (createdId && assessmentId) {
          await linkAssessmentToProfession(createdId, assessmentId);
        }
      }

      await load({ silent: true });
      setAddIndustryOpen(false);
      setExtraCustomNamesForIndustryCreate([]);
      setPendingCustomAssessmentByName({});
      selectIndustry(value.industryKey, { expand: true });
      toast.success(
        value.catalogKeys.length || value.customNames.length
          ? "Industry created with professions"
          : "Industry created"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create industry");
      await load({ silent: true });
    } finally {
      setCreatingIndustry(false);
    }
  }

  function openEditIndustry(industryKeyToEdit: string) {
    setAddIndustryOpen(false);
    setEditIndustryKey(industryKeyToEdit);
    selectIndustry(industryKeyToEdit);
  }

  async function saveIndustryFromModal(value: AddIndustryFormValue) {
    if (!canManage || creatingIndustry || !editIndustryKey) return;
    setCreatingIndustry(true);
    try {
      const existingKeys = new Set(
        (professionsByIndustry[value.industryKey] ?? [])
          .map((row) => row.catalogKey)
          .filter((key): key is string => Boolean(key))
      );
      const toAdd = value.catalogKeys.filter((key) => !existingKeys.has(key));

      setIndustryMetaByKey((current) => ({
        ...current,
        [value.industryKey]: {
          description: value.description,
          iconId: value.iconId,
        },
      }));

      for (const catalogKey of toAdd) {
        await createProfessionQuiet({
          catalogKey,
          industryKey: value.industryKey,
        });
      }

      await load({ silent: true });
      setEditIndustryKey(null);
      selectIndustry(value.industryKey, { expand: true });
      toast.success(toAdd.length ? "Industry updated with new professions" : "Industry updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update industry");
      await load({ silent: true });
    } finally {
      setCreatingIndustry(false);
    }
  }

  const editIndustry = editIndustryKey
    ? industries.find((row) => row.key === editIndustryKey) ?? null
    : null;
  const editIndustryLockedCatalogKeys = useMemo(
    () =>
      editIndustryKey
        ? (professionsByIndustry[editIndustryKey] ?? [])
            .map((row) => row.catalogKey)
            .filter((key): key is string => Boolean(key))
        : [],
    [editIndustryKey, professionsByIndustry]
  );
  const editIndustryProfessionOptions = useMemo(() => {
    if (!editIndustryKey) return [];
    const available = availableProfessions.filter(
      (option) => option.industryKey === editIndustryKey
    );
    const existing = (professionsByIndustry[editIndustryKey] ?? [])
      .filter((row) => row.catalogKey)
      .map((row) => ({
        key: row.catalogKey as string,
        name: row.name,
        industryKey: editIndustryKey,
      }));
    const byKey = new Map<string, { key: string; name: string; industryKey: string }>();
    for (const option of [...existing, ...available]) {
      byKey.set(option.key, option);
    }
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [editIndustryKey, availableProfessions, professionsByIndustry]);
  const editIndustryInitialValue = useMemo(() => {
    if (!editIndustry) return null;
    return {
      industryKey: editIndustry.key,
      description:
        industryMetaByKey[editIndustry.key]?.description ||
        industryDescription(editIndustry.key, editIndustry.label).slice(0, 100),
      iconId: industryMetaByKey[editIndustry.key]?.iconId ?? "code",
      catalogKeys: editIndustryLockedCatalogKeys,
      customNames: [] as string[],
    };
  }, [editIndustry, industryMetaByKey, editIndustryLockedCatalogKeys]);

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
      return;
    }
    if (dirty && !window.confirm("Discard unsaved document changes for this profession?")) return;
    discardDirtyDraft();
    setConfirmRemove(false);
    setRowMenuId(null);
    router.push(professionDetailHref(professionId));
  }

  async function createProfession(body: {
    name?: string;
    catalogKey?: string;
    industryKey: string;
  }) {
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
      setCustomNameByIndustry((current) => ({ ...current, [body.industryKey]: "" }));
      setSelectedCatalogKeyByIndustry((current) => ({ ...current, [body.industryKey]: "" }));
      setConfirmRemove(false);
      toast.success("Profession added");
      await load({ silent: true });
      if (createdId) router.push(professionDetailHref(createdId));
      else setExpandedByIndustry((current) => ({ ...current, [body.industryKey]: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add profession");
    } finally {
      setAddingProfession(false);
    }
  }

  async function addCatalogProfession(forIndustryKey: string) {
    const catalogKey = (selectedCatalogKeyByIndustry[forIndustryKey] ?? "").trim();
    if (!catalogKey) return;
    await createProfession({ catalogKey, industryKey: forIndustryKey });
  }

  async function linkAssessmentToProfession(professionId: string, assessmentId: string) {
    if (!assessmentDraft) return;
    const source = assessmentDraft.categories.find((category) => category.id === assessmentId);
    if (!source) return;
    const nextCatalog: SkillAssessmentCatalog = {
      ...assessmentDraft,
      categories: [
        ...assessmentDraft.categories,
        {
          ...source,
          id: crypto.randomUUID(),
          professionId,
          sortOrder: assessmentDraft.categories.length + 1,
          questions: source.questions.map((question) => ({
            ...question,
            id: crypto.randomUUID(),
            options: question.options.map((option) => ({ ...option })),
          })),
        },
      ],
    };
    const response = await fetch("/api/admin/assessment-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalog: nextCatalog }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      settings?: { draft?: unknown };
    };
    if (!response.ok) throw new Error(payload.error || "Could not link assessment");
    const draft = normalizeSkillAssessmentCatalog(payload.settings?.draft ?? nextCatalog);
    setAssessmentDraft(draft);
    setAssessmentLabelByProfession((current) => ({
      ...current,
      [professionId]: source.name,
    }));
  }

  async function createCustomProfessionFromModal(value: AddCustomProfessionFormValue) {
    if (!canManage || !customProfessionIndustryKey || addingProfession) return;

    if (customProfessionPendingForIndustryCreate) {
      setExtraCustomNamesForIndustryCreate((current) =>
        current.some((name) => name.toLowerCase() === value.name.toLowerCase())
          ? current
          : [...current, value.name]
      );
      setPendingCustomAssessmentByName((current) => ({
        ...current,
        [value.name]: value.assessmentId,
      }));
      setCustomProfessionIndustryKey(null);
      setCustomProfessionPendingForIndustryCreate(false);
      toast.success("Custom profession added to industry draft");
      return;
    }

    const industryKeyForCreate = customProfessionIndustryKey;
    setAddingProfession(true);
    try {
      const response = await fetch("/api/admin/professions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value.name,
          industryKey: industryKeyForCreate,
        }),
      });
      const payload = (await response.json()) as { error?: string; profession?: { id?: string } };
      if (!response.ok) throw new Error(payload.error || "Could not add profession");
      const createdId = payload.profession?.id?.trim() || null;
      if (createdId && value.assessmentId) {
        await linkAssessmentToProfession(createdId, value.assessmentId);
      }
      setCustomProfessionIndustryKey(null);
      toast.success("Profession added");
      await load({ silent: true });
      if (createdId) router.push(professionDetailHref(createdId));
      else {
        setExpandedByIndustry((current) => ({
          ...current,
          [industryKeyForCreate]: true,
        }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add profession");
    } finally {
      setAddingProfession(false);
    }
  }

  function openCustomProfessionModal(industryKeyToUse: string, options?: { pending?: boolean }) {
    setCustomProfessionPendingForIndustryCreate(Boolean(options?.pending));
    setCustomProfessionIndustryKey(industryKeyToUse);
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

  async function removeProfession(target?: ProfessionRow | null) {
    const profession = target ?? pendingDeleteProfession ?? selected;
    if (!profession || !canManage || removingProfession) return;
    setRemovingProfession(true);
    try {
      const response = await fetch(`/api/admin/professions/${profession.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete profession");
      setConfirmRemove(false);
      setPendingDeleteProfession(null);
      setEditingProfessionId(null);
      setRowMenuId(null);
      toast.success("Profession removed");
      await load({ silent: true });
      if (profession.industryKey) {
        setExpandedByIndustry((current) => ({ ...current, [profession.industryKey!]: true }));
      }
      if (isDetailView) router.replace(PROFESSION_LIST_HREF);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete profession");
    } finally {
      setRemovingProfession(false);
    }
  }

  function selectIndustry(key: string, options?: { expand?: boolean }) {
    setSelectedIndustryKey(key);
    if (options?.expand) {
      setExpandedByIndustry((current) => ({ ...current, [key]: true }));
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

  if (isDetailView) {
    return (
      <section className="space-y-5">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {!error && !selected && !loading ? (
          <p className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-sm text-[#64748B]">
            Profession not found.{" "}
            <Link href={PROFESSION_LIST_HREF} className="font-medium text-[#012352] hover:underline">
              Back to all professions
            </Link>
          </p>
        ) : null}
        {selected ? (
          <div
            ref={documentsPanelRef}
            tabIndex={-1}
            className="scroll-mt-4 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm shadow-slate-900/[0.03] outline-none"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] px-4 py-4 sm:px-5">
              <div className="min-w-0 space-y-3">
                <Link
                  href={PROFESSION_LIST_HREF}
                  onClick={(event) => {
                    if (dirty && !window.confirm("Discard unsaved document changes for this profession?")) {
                      event.preventDefault();
                      return;
                    }
                    discardDirtyDraft();
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#012352] hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  All professions
                </Link>
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
                        value={settingsDocumentKind(doc.documentKind)}
                        disabled={!canManage}
                        onChange={(event) =>
                          updateDocument(doc.id, {
                            documentKind: settingsDocumentKind(
                              event.target.value as DocumentKind
                            ),
                          })
                        }
                      >
                        {SETTINGS_PROFESSION_DOCUMENT_KINDS.map((kind) => (
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
                  {saving ? "Savingâ€¦" : "Save documents"}
                </button>
              </div>
              {!canManage ? (
                <p className="text-xs text-[#64748B]">Only an administrator can change these documents.</p>
              ) : null}
            </div>

            <div className="border-t border-[#F1F5F9] p-4 sm:p-5">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
                <Suspense
                  fallback={
                    <p className="text-sm text-[#64748B]">Loading skill assessmentâ€¦</p>
                  }
                >
                  <AssessmentSettingsPanel
                    embedded
                    professionId={selected.id}
                    professionName={selected.name}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        ) : null}

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

  const selectedIndustryCodePrefix = selectedIndustry
    ? industryPrefix(selectedIndustry.label)
    : "PR";
  const selectedIndustrySampleCode = `${selectedIndustryCodePrefix}-${String(
    Math.max(selectedIndustryProfessions.length, 1)
  ).padStart(3, "0")}`;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Professions</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Organize job industry and manage their positions.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setAddIndustryOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add Industry
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4 overflow-visible">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search job categories and positions..."
              aria-label="Search job categories and positions"
              className={`${inputClassName} h-11 rounded-xl pl-9`}
            />
          </div>

          {visibleIndustries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#0F172A]">
                {industries.length === 0 ? "No industries yet" : "No matching industries"}
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                {industries.length === 0
                  ? "Add an industry to start organizing professions and documents."
                  : "Try a different search or industry filter."}
              </p>
              {canManage && industries.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setAddIndustryOpen(true)}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Industry
                </button>
              ) : null}
            </div>
          ) : (
            visibleIndustries.map((industry) => {
              const industryProfessions = filteredProfessionsByIndustry[industry.key] ?? [];
              const totalCount = (professionsByIndustry[industry.key] ?? []).length;
              const industryAvailable = availableProfessions.filter(
                (option) => option.industryKey === industry.key
              );
              const listExpanded = expandedByIndustry[industry.key] ?? false;
              const selectedCatalogKey = selectedCatalogKeyByIndustry[industry.key] ?? "";
              const isSelectedIndustry = selectedIndustry?.key === industry.key;
              const industryMeta = industryMetaByKey[industry.key];

              return (
                <div
                  key={industry.key}
                  className={`relative rounded-2xl border bg-white shadow-sm shadow-slate-900/[0.03] ${
                    isSelectedIndustry ? "border-[#CBD5E1] z-[1]" : "border-[#E5E7EB]"
                  }`}
                >
                  <div className="flex items-center gap-1 px-3 py-3 sm:gap-2 sm:px-4">
                    <button
                      type="button"
                      onClick={() => {
                        selectIndustry(industry.key);
                        setExpandedByIndustry((current) => ({
                          ...current,
                          [industry.key]: !(current[industry.key] ?? false),
                        }));
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left hover:bg-[#F8FAFC]"
                      aria-expanded={listExpanded}
                    >
                      {industryMeta?.iconId ? (
                        <IndustryIconBadge iconId={industryMeta.iconId} />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#012352]">
                          <Briefcase className="h-5 w-5" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#0F172A]">
                            {industry.label}
                          </span>
                          {industry.isPrimary ? (
                            <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#012352]">
                              Primary
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-[#64748B]">
                          {totalCount} {totalCount === 1 ? "position" : "positions"} available
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={listExpanded ? `Collapse ${industry.label}` : `Expand ${industry.label}`}
                        onClick={() => {
                          selectIndustry(industry.key);
                          setExpandedByIndustry((current) => ({
                            ...current,
                            [industry.key]: !(current[industry.key] ?? false),
                          }));
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                      >
                        {listExpanded ? (
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        )}
                      </button>

                      <div
                        className="relative"
                        ref={industryMenuKey === industry.key ? industryMenuRef : undefined}
                      >
                        <button
                          type="button"
                          aria-label={`Industry actions for ${industry.label}`}
                          onClick={() => {
                            selectIndustry(industry.key);
                            setIndustryMenuKey((current) =>
                              current === industry.key ? null : industry.key
                            );
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                        {industryMenuKey === industry.key ? (
                          <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setIndustryMenuKey(null);
                                selectIndustry(industry.key, { expand: true });
                                openCustomProfessionModal(industry.key);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                              Add position
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIndustryMenuKey(null);
                                openEditIndustry(industry.key);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Edit industry
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {listExpanded ? (
                    <div className="overflow-visible rounded-b-2xl border-t border-[#F1F5F9]">
                      {industryProfessions.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <p className="text-sm font-medium text-[#0F172A]">No professions yet</p>
                          <p className="mt-1 text-sm text-[#64748B]">
                            Add a position below to configure documents and assessments.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                              <tr>
                                <th className="px-4 py-2.5 font-semibold">Code</th>
                                <th className="px-4 py-2.5 font-semibold">Professions</th>
                                <th className="px-4 py-2.5 font-semibold">Linked Assessment</th>
                                <th className="px-4 py-2.5 font-semibold">Documents</th>
                                <th className="px-4 py-2.5 font-semibold">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {industryProfessions.map((profession, rowIndex) => {
                                const globalIndex = professions.findIndex(
                                  (row) => row.id === profession.id
                                );
                                const code = professionCode(
                                  profession,
                                  globalIndex >= 0 ? globalIndex : rowIndex,
                                  industry.label
                                );
                                const assessmentLabel =
                                  assessmentLabelByProfession[profession.id] ?? "—";
                                return (
                                  <tr
                                    key={profession.id}
                                    className="border-t border-[#F1F5F9] bg-white"
                                  >
                                    <td className="px-4 py-3 font-mono text-xs text-[#64748B]">
                                      {code}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Link
                                        href={professionDetailHref(profession.id)}
                                        className="text-sm font-medium text-[#C2410C] hover:underline"
                                      >
                                        {profession.name}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3 text-[#64748B]">{assessmentLabel}</td>
                                    <td className="px-4 py-3">
                                      <Link
                                        href={professionDetailHref(profession.id)}
                                        className="text-sm font-medium text-[#C2410C] hover:underline"
                                      >
                                        View Docs
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div
                                        className="relative"
                                        ref={rowMenuId === profession.id ? rowMenuRef : undefined}
                                      >
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
                                            <div className="absolute right-0 top-9 z-50 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
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
                                                    setRowMenuId(null);
                                                    setPendingDeleteProfession(profession);
                                                  }}
                                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#B91C1C] hover:bg-red-50"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                  Delete
                                                </button>
                                              </div>
                                            ) : null}
                                          </>
                                        ) : (
                                          <span className="text-xs text-[#94A3B8]">—</span>
                                        )}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                selectIndustry(industry.key);
                                openCustomProfessionModal(industry.key);
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC]"
                            >
                              <Plus className="h-4 w-4" aria-hidden />
                              Add Position
                            </button>
                          </div>

                          {industryAvailable.length > 0 ? (
                            <form
                              className="relative z-20 flex flex-col gap-2 overflow-visible sm:flex-row sm:items-center"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void addCatalogProfession(industry.key);
                              }}
                            >
                              <SelectField
                                label={`Select catalog profession for ${industry.label}`}
                                value={selectedCatalogKey}
                                onChange={(event) =>
                                  setSelectedCatalogKeyByIndustry((current) => ({
                                    ...current,
                                    [industry.key]: event.target.value,
                                  }))
                                }
                                className="sm:w-[280px]"
                                dropUp
                              >
                                <option value="">Or choose from catalog</option>
                                {industryAvailable.map((option) => (
                                  <option key={option.key} value={option.key}>
                                    {option.name}
                                  </option>
                                ))}
                              </SelectField>
                              <button
                                type="submit"
                                disabled={addingProfession || selectedCatalogKey.length === 0}
                                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#012352] bg-white px-3 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC] disabled:opacity-50"
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
              );
            })
          )}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center gap-2">
            <SelectField
              label="Filter industries"
              value={industryFilterKey}
              onChange={(event) => setIndustryFilterKey(event.target.value || "all")}
              className="min-w-0 flex-1"
            >
              <option value="all">All Industry</option>
              {industries.map((industry) => (
                <option key={industry.key} value={industry.key}>
                  {industry.label}
                </option>
              ))}
            </SelectField>
            <button
              type="button"
              aria-label="Industry filters"
              onClick={() => setIndustryFilterKey("all")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {selectedIndustry ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
              <div className="flex items-start gap-3">
                {industryMetaByKey[selectedIndustry.key]?.iconId ? (
                  <IndustryIconBadge iconId={industryMetaByKey[selectedIndustry.key]?.iconId} />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#012352]">
                    <Briefcase className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-[#0F172A]">
                        {selectedIndustry.label}
                      </h2>
                      <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
                        {industryMetaByKey[selectedIndustry.key]?.description ||
                          industryTagline(selectedIndustry.key, selectedIndustry.label)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditIndustry(selectedIndustry.key)}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-[#012352] hover:bg-[#F8FAFC]"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#334155]">Profession Code</span>
                  <input
                    readOnly
                    value={selectedIndustrySampleCode}
                    className={`${inputClassName} bg-[#F8FAFC]`}
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#334155]">Description</span>
                  <textarea
                    readOnly
                    rows={4}
                    value={
                      industryMetaByKey[selectedIndustry.key]?.description ||
                      industryDescription(selectedIndustry.key, selectedIndustry.label)
                    }
                    className="w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm leading-6 text-[#0F172A] outline-none"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#334155]">Total Positions</span>
                  <input
                    readOnly
                    value={String(selectedIndustryProfessions.length)}
                    className={`${inputClassName} bg-[#F8FAFC]`}
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#334155]">Professions</p>
                  {selectedIndustryProfessions.length === 0 ? (
                    <p className="text-sm text-[#94A3B8]">No positions added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedIndustryProfessions.map((profession) => (
                        <Link
                          key={profession.id}
                          href={professionDetailHref(profession.id)}
                          className="inline-flex rounded-full bg-[#EEF2F6] px-3 py-1.5 text-xs font-medium text-[#334155] hover:bg-[#E2E8F0]"
                        >
                          {profession.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-4 py-8 text-center text-sm text-[#64748B]">
              Select an industry to view details.
            </div>
          )}
        </aside>
      </div>

      <AddIndustryModal
        open={addIndustryOpen}
        mode="create"
        industries={addableIndustries}
        availableProfessions={availableProfessions}
        extraCustomNames={extraCustomNamesForIndustryCreate}
        creating={creatingIndustry || Boolean(addingIndustryKey)}
        onClose={() => {
          if (creatingIndustry || addingIndustryKey) return;
          setAddIndustryOpen(false);
          setExtraCustomNamesForIndustryCreate([]);
          setPendingCustomAssessmentByName({});
        }}
        onSubmit={(value) => void createIndustryFromModal(value)}
        onRequestCustomProfession={(industryKeyToUse) =>
          openCustomProfessionModal(industryKeyToUse, { pending: true })
        }
        onRemoveExtraCustomName={(name) => {
          setExtraCustomNamesForIndustryCreate((current) =>
            current.filter((item) => item !== name)
          );
          setPendingCustomAssessmentByName((current) => {
            const next = { ...current };
            delete next[name];
            return next;
          });
        }}
      />

      <AddIndustryModal
        open={Boolean(editIndustry)}
        mode="edit"
        industries={
          editIndustry
            ? [{ key: editIndustry.key, label: editIndustry.label }]
            : []
        }
        availableProfessions={editIndustryProfessionOptions}
        lockedCatalogKeys={editIndustryLockedCatalogKeys}
        initialValue={editIndustryInitialValue}
        creating={creatingIndustry}
        onClose={() => {
          if (creatingIndustry) return;
          setEditIndustryKey(null);
        }}
        onSubmit={(value) => void saveIndustryFromModal(value)}
      />

      <AddCustomProfessionModal
        open={Boolean(customProfessionIndustryKey)}
        industryLabel={
          industries.find((row) => row.key === customProfessionIndustryKey)?.label ||
          addableIndustries.find((row) => row.key === customProfessionIndustryKey)?.label ||
          "Industry"
        }
        assessments={assessmentOptions}
        creating={addingProfession}
        onClose={() => {
          if (addingProfession) return;
          setCustomProfessionIndustryKey(null);
          setCustomProfessionPendingForIndustryCreate(false);
        }}
        onCreate={(value) => void createCustomProfessionFromModal(value)}
      />

      {pendingDeleteProfession ? (
        <ConfirmDialog
          title={`Delete ${pendingDeleteProfession.name}?`}
          message="This removes the profession from your organization and deactivates its document requirements. You can add it again later. Onboarding flows that still use this profession must be updated first."
          confirmLabel="Remove"
          confirming={removingProfession}
          onCancel={() => setPendingDeleteProfession(null)}
          onConfirm={() => void removeProfession(pendingDeleteProfession)}
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

