"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import AssessmentPreviewModal from "@/app/admin_recruiter/settings/AssessmentPreviewModal";
import { assessmentDetailHref } from "@/app/admin_recruiter/settings/assessment-routes";
import {
  catalogsAreEqual,
  cloneSkillAssessmentCatalog,
  createEmptySkillCategory,
  createEmptySkillQuestion,
  duplicateSkillQuestion,
  EMPTY_PROFESSION_ASSESSMENT_PROFILE,
  getProfessionAssessmentProfile,
  normalizeSkillAssessmentCatalog,
  reorderItems,
  skillCategoriesForProfession,
  slugifySkillCategoryName,
} from "@/lib/skill-assessment/catalog";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import type {
  ProfessionAssessmentProfile,
  SkillAssessmentCatalog,
  SkillCategoryDraft,
  SkillQuestionDraft,
  SkillQuestionType,
} from "@/lib/skill-assessment/types";
import { SKILL_QUESTION_TYPES } from "@/lib/skill-assessment/types";

type ProfessionOption = {
  id: string;
  name: string;
  catalogKey: string | null;
  industryKey: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type IndustryOption = {
  key: string;
  label: string;
  description?: string | null;
};

const brandFocusClassName =
  "outline-none transition-colors focus:border-[color:var(--brand-secondary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] focus-visible:border-[color:var(--brand-secondary)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)]";

const fieldInputClassName =
  `h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] disabled:bg-[#F8FAFC] ${brandFocusClassName}`;

const editorFieldClassName =
  `w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] disabled:bg-[#F8FAFC] ${brandFocusClassName}`;

function BrandCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer h-5 w-5 cursor-pointer appearance-none rounded-[6px] border border-[#CBD5E1] bg-white checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto hidden h-3.5 w-3.5 text-white peer-checked:block"
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );
}

function industryPrefix(label: string | null | undefined): string {
  const parts = (label ?? "PR").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? "P"}${parts[1][0] ?? "R"}`.toUpperCase();
  return (parts[0] ?? "PR").slice(0, 2).toUpperCase();
}

function formatProfessionCode(
  profession: ProfessionOption | null,
  index: number,
  industryLabel: string | null
): string {
  if (profession?.catalogKey) {
    return profession.catalogKey.replace(/_/g, "-").toUpperCase();
  }
  return `${industryPrefix(industryLabel)}-${String(index + 1).padStart(3, "0")}`;
}

function formatLongDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type AssessmentSettingsPanelProps = {
  /** When set, only categories for this profession are shown/edited. */
  professionId?: string | null;
  professionName?: string | null;
  /** Compact layout under Profession detail (hides global scoring chrome). */
  embedded?: boolean;
  /**
   * Full-page chrome for `/settings/assessment/[professionId]`:
   * back link, profession title, and description above the editor.
   */
  fullPage?: boolean;
};

const QUESTION_TYPE_LABELS: Record<SkillQuestionType, string> = {
  multiple_choice: "Multiple choice",
  multiple_select: "Multiple select",
  yes_no: "Yes / No",
  true_false: "True / False",
  rating: "Rating / proficiency scale",
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? "bg-[color:var(--brand-secondary)]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
        <p className="mt-2 text-sm text-[#64748B]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#012352]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[#B91C1C] px-4 py-2 text-sm font-medium text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  onChange,
  disabled,
}: {
  question: SkillQuestionDraft;
  onChange: (next: SkillQuestionDraft) => void;
  disabled?: boolean;
}) {
  const choiceType = question.type === "multiple_choice" || question.type === "multiple_select";

  function setType(type: SkillQuestionType) {
    const next: SkillQuestionDraft = { ...question, type };
    if (type === "yes_no") {
      next.options = [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ];
      next.correctAnswer = null;
    } else if (type === "true_false") {
      next.options = [
        { id: "true", label: "True" },
        { id: "false", label: "False" },
      ];
      next.correctAnswer = null;
    } else if (type === "rating") {
      next.options = [];
      next.correctAnswer = null;
    } else if (question.options.length === 0) {
      next.options = [
        { id: crypto.randomUUID(), label: "Option 1" },
        { id: crypto.randomUUID(), label: "Option 2" },
      ];
      next.correctAnswer = type === "multiple_select" ? [] : null;
    }
    onChange(next);
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[#0F172A]">Question</span>
        <textarea
          value={question.text}
          disabled={disabled}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
          className={`min-h-16 py-2 ${editorFieldClassName}`}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[#0F172A]">Help text (optional)</span>
        <input
          value={question.description ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...question, description: e.target.value || null })}
          className={`h-9 ${editorFieldClassName}`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#0F172A]">Type</span>
          <select
            value={question.type}
            disabled={disabled}
            onChange={(e) => setType(e.target.value as SkillQuestionType)}
            className={`h-9 px-2 ${editorFieldClassName}`}
          >
            {SKILL_QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#0F172A]">Points</span>
          <input
            type="number"
            min={0}
            value={question.points}
            disabled={disabled}
            onChange={(e) => onChange({ ...question, points: Number(e.target.value) || 0 })}
            className={`h-9 ${editorFieldClassName}`}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-sm text-[#0F172A]">
          <input
            type="checkbox"
            checked={question.required}
            disabled={disabled}
            onChange={(e) => onChange({ ...question, required: e.target.checked })}
          />
          Required
        </label>
      </div>

      {choiceType || question.type === "yes_no" || question.type === "true_false" ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0F172A]">Answer choices</p>
          {question.options.map((option) => {
            const isCorrect = Array.isArray(question.correctAnswer)
              ? question.correctAnswer.includes(option.id)
              : question.correctAnswer === option.id;
            return (
              <div key={option.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={option.label}
                  disabled={disabled || question.type === "yes_no" || question.type === "true_false"}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      options: question.options.map((row) =>
                        row.id === option.id ? { ...row, label: e.target.value } : row
                      ),
                    })
                  }
                  className={`h-9 min-w-0 flex-1 ${editorFieldClassName}`}
                />
                {choiceType ? (
                  <input
                    type="number"
                    placeholder="Pts"
                    value={option.points ?? ""}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        options: question.options.map((row) =>
                          row.id === option.id
                            ? { ...row, points: e.target.value === "" ? null : Number(e.target.value) }
                            : row
                        ),
                      })
                    }
                    className={`h-9 w-20 px-2 ${editorFieldClassName}`}
                  />
                ) : null}
                <label className="flex items-center gap-1 text-xs text-[#334155]">
                  <input
                    type={question.type === "multiple_select" ? "checkbox" : "radio"}
                    name={`correct-${question.id}`}
                    checked={isCorrect}
                    disabled={disabled}
                    onChange={() => {
                      if (question.type === "multiple_select") {
                        const current = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                        const next = isCorrect
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id];
                        onChange({
                          ...question,
                          correctAnswer: next,
                          options: question.options.map((row) => ({
                            ...row,
                            isCorrect: next.includes(row.id),
                          })),
                        });
                      } else {
                        onChange({
                          ...question,
                          correctAnswer: option.id,
                          options: question.options.map((row) => ({
                            ...row,
                            isCorrect: row.id === option.id,
                          })),
                        });
                      }
                    }}
                  />
                  Correct
                </label>
                {choiceType && !disabled ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...question,
                        options: question.options.filter((row) => row.id !== option.id),
                        correctAnswer: Array.isArray(question.correctAnswer)
                          ? question.correctAnswer.filter((id) => id !== option.id)
                          : question.correctAnswer === option.id
                            ? null
                            : question.correctAnswer,
                      })
                    }
                    className="text-[#B91C1C]"
                    aria-label="Remove choice"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
          {choiceType && !disabled ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...question,
                  options: [
                    ...question.options,
                    { id: crypto.randomUUID(), label: `Option ${question.options.length + 1}` },
                  ],
                })
              }
              className="text-xs font-medium text-[#012352]"
            >
              + Add choice
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-[#64748B]">Applicants rate this skill from 1 to 4 on the proficiency scale.</p>
      )}
    </div>
  );
}

export default function AssessmentSettingsPanel({
  professionId: professionIdProp = null,
  professionName: professionNameProp = null,
  embedded = false,
  fullPage = false,
}: AssessmentSettingsPanelProps) {
  const searchParams = useSearchParams();
  const professionIdFromQuery = searchParams.get("profession")?.trim() || null;
  const professionId = professionIdProp?.trim() || professionIdFromQuery;
  const [professionName, setProfessionName] = useState(professionNameProp?.trim() || "");
  const [professions, setProfessions] = useState<ProfessionOption[]>([]);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<SkillAssessmentCatalog | null>(null);
  const [savedCatalog, setSavedCatalog] = useState<SkillAssessmentCatalog | null>(null);
  const [publishedCatalog, setPublishedCatalog] = useState<SkillAssessmentCatalog | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passingScoreInput, setPassingScoreInput] = useState<string | null>(null);
  const [scoreNotice, setScoreNotice] = useState<string | null>(null);
  const scoreInvalid = passingScoreInput !== null &&
    (!/^\d+$/.test(passingScoreInput) || Number(passingScoreInput) > 100);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(
    null
  );
  const dragCategoryId = useRef<string | null>(null);
  const dragQuestionId = useRef<string | null>(null);
  const dragMovedRef = useRef(false);

  const dirty = Boolean(catalog && savedCatalog && !catalogsAreEqual(catalog, savedCatalog));
  const unpublished = Boolean(catalog && (!publishedCatalog || !catalogsAreEqual(catalog, publishedCatalog)));
  const visibleCategories = useMemo(
    () => (catalog ? skillCategoriesForProfession(catalog, professionId) : []),
    [catalog, professionId]
  );
  const previewCatalog = useMemo(() => {
    if (!catalog) return null;
    if (!professionId) return catalog;
    return { ...catalog, categories: visibleCategories };
  }, [catalog, professionId, visibleCategories]);

  const selectedProfession = useMemo(
    () => (professionId ? professions.find((row) => row.id === professionId) ?? null : null),
    [professionId, professions]
  );
  const selectedIndustry = useMemo(() => {
    const key = selectedProfession?.industryKey?.trim() || "";
    if (!key) return null;
    return industries.find((row) => row.key === key) ?? null;
  }, [industries, selectedProfession]);
  const professionIndex = useMemo(() => {
    if (!selectedProfession) return 0;
    const sameIndustry = professions.filter(
      (row) => row.industryKey === selectedProfession.industryKey
    );
    const idx = sameIndustry.findIndex((row) => row.id === selectedProfession.id);
    return idx >= 0 ? idx : 0;
  }, [professions, selectedProfession]);
  const professionCode = useMemo(
    () =>
      formatProfessionCode(
        selectedProfession,
        professionIndex,
        selectedIndustry?.label ?? selectedProfession?.industryKey ?? null
      ),
    [professionIndex, selectedIndustry?.label, selectedProfession]
  );
  const professionProfile = useMemo(
    () => (catalog ? getProfessionAssessmentProfile(catalog, professionId) : EMPTY_PROFESSION_ASSESSMENT_PROFILE),
    [catalog, professionId]
  );
  const professionDescription =
    professionProfile.description?.trim() ||
    selectedIndustry?.description?.trim() ||
    (selectedIndustry?.label
      ? `Assessment categories and questions for ${professionName || "this profession"} in ${selectedIndustry.label}.`
      : "Categories and questions applicants complete for this profession.");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assessmentRes, professionsRes] = await Promise.all([
        fetch("/api/admin/assessment-settings"),
        fetch("/api/admin/profession-documents"),
      ]);
      const payload = await assessmentRes.json();
      if (!assessmentRes.ok) throw new Error(payload.error || "Failed to load assessment settings");
      const draft = normalizeSkillAssessmentCatalog(payload.settings?.draft);
      setCatalog(draft);
      setPassingScoreInput(null);
      setScoreNotice(null);
      setSavedCatalog(cloneSkillAssessmentCatalog(draft));
      setPublishedCatalog(payload.settings?.published ? normalizeSkillAssessmentCatalog(payload.settings.published) : null);
      setCanManage(Boolean(payload.canManage));
      setDraftUpdatedAt(
        typeof payload.settings?.draftUpdatedAt === "string" ? payload.settings.draftUpdatedAt : null
      );

      if (professionsRes.ok) {
        const professionsPayload = (await professionsRes.json()) as {
          industries?: Array<{ key: string; label: string; description?: string | null }>;
          professions?: Array<{
            id: string;
            name: string;
            catalogKey?: string | null;
            industryKey?: string | null;
            isActive?: boolean;
            createdAt?: string | null;
            updatedAt?: string | null;
          }>;
        };
        setIndustries(
          (professionsPayload.industries ?? []).map((row) => ({
            key: row.key,
            label: row.label,
            description: row.description ?? null,
          }))
        );
        const options = (professionsPayload.professions ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          catalogKey: row.catalogKey ?? null,
          industryKey: row.industryKey ?? null,
          isActive: row.isActive !== false,
          createdAt: row.createdAt ?? null,
          updatedAt: row.updatedAt ?? null,
        }));
        setProfessions(options);
        if (!professionNameProp && professionId) {
          setProfessionName(options.find((row) => row.id === professionId)?.name ?? "");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load assessment settings");
    } finally {
      setLoading(false);
    }
  }, [professionId, professionNameProp]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (professionNameProp?.trim()) setProfessionName(professionNameProp.trim());
  }, [professionNameProp]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function updateCatalog(updater: (current: SkillAssessmentCatalog) => SkillAssessmentCatalog) {
    setCatalog((current) => (current ? normalizeSkillAssessmentCatalog(updater(current)) : current));
  }

  function updateProfessionProfile(patch: Partial<ProfessionAssessmentProfile>) {
    if (!professionId) return;
    updateCatalog((current) => {
      const existing = getProfessionAssessmentProfile(current, professionId);
      return {
        ...current,
        professionProfiles: {
          ...current.professionProfiles,
          [professionId]: {
            ...existing,
            ...patch,
          },
        },
      };
    });
  }

  async function saveDraft() {
    if (!catalog || scoreInvalid) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/assessment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save draft");
      const draft = normalizeSkillAssessmentCatalog(payload.settings?.draft);
      setCatalog(draft);
      setPassingScoreInput(null);
      setScoreNotice(null);
      setSavedCatalog(cloneSkillAssessmentCatalog(draft));
      setPublishedCatalog(payload.settings?.published ? normalizeSkillAssessmentCatalog(payload.settings.published) : null);
      setDraftUpdatedAt(
        typeof payload.settings?.draftUpdatedAt === "string" ? payload.settings.draftUpdatedAt : null
      );
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!catalog || scoreInvalid) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/assessment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", catalog }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to publish");
      const draft = normalizeSkillAssessmentCatalog(payload.settings?.draft);
      setCatalog(draft);
      setPassingScoreInput(null);
      setScoreNotice(null);
      setSavedCatalog(cloneSkillAssessmentCatalog(draft));
      setPublishedCatalog(cloneSkillAssessmentCatalog(draft));
      toast.success("Assessment published for new applicants");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdits() {
    if (!savedCatalog) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setCatalog(cloneSkillAssessmentCatalog(savedCatalog));
    setPassingScoreInput(null);
    setScoreNotice(null);
    setEditingQuestionId(null);
  }

  function updateCategory(categoryId: string, patch: Partial<SkillCategoryDraft>) {
    updateCatalog((current) => ({
      ...current,
      categories: current.categories.map((category) => {
        if (category.id !== categoryId) return category;
        const next = { ...category, ...patch };
        if (patch.name && !patch.slug) next.slug = slugifySkillCategoryName(patch.name, category.slug);
        return next;
      }),
    }));
  }

  function seedProfessionFromDefaults() {
    if (!professionId) return;
    updateCatalog((current) => {
      const seeded = createDefaultSkillAssessmentCatalog().categories.map((category, index) => ({
        ...category,
        id: crypto.randomUUID(),
        professionId,
        sortOrder: current.categories.length + index + 1,
        questions: category.questions.map((question) => ({
          ...question,
          id: crypto.randomUUID(),
          options: question.options.map((option) => ({
            ...option,
            id: crypto.randomUUID(),
          })),
        })),
      }));
      return { ...current, categories: [...current.categories, ...seeded] };
    });
    toast.success(`Default categories added for ${professionName || "this profession"}`);
  }

  function reorderVisibleCategories(fromId: string, toId: string) {
    updateCatalog((current) => {
      const visible = skillCategoriesForProfession(current, professionId);
      const reorderedVisible = reorderItems(visible, fromId, toId).map((row, order) => ({
        ...row,
        sortOrder: order + 1,
      }));
      if (!professionId) {
        return { ...current, categories: reorderedVisible };
      }
      const others = current.categories.filter((row) => row.professionId !== professionId);
      return {
        ...current,
        categories: [...others, ...reorderedVisible].map((row, order) => ({
          ...row,
          sortOrder: order + 1,
        })),
      };
    });
  }

  function updateQuestion(categoryId: string, question: SkillQuestionDraft) {
    updateCatalog((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              questions: category.questions.map((row) => (row.id === question.id ? question : row)),
            }
          : category
      ),
    }));
  }

  if (loading || !catalog) {
    return (
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-[#64748B]">Loading assessment settings…</p>
      </section>
    );
  }

  const statusBadge = dirty ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Unsaved
    </span>
  ) : unpublished ? (
    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
      Unpublished draft
    </span>
  ) : (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
      Published
    </span>
  );

  const activeStatusChip = (
    <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-medium text-[#15803D]">
      Active
    </span>
  );
  const inactiveStatusChip = (
    <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-medium text-[#B91C1C]">
      Inactive
    </span>
  );
  const professionIsActive = selectedProfession?.isActive !== false && catalog.enabled;

  return (
    <section className={`space-y-5 ${fullPage ? "pb-28" : ""}`}>
      {fullPage ? (
        <div className="space-y-5">
          <Link
            href="/admin_recruiter/settings/assessment"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-[#0F172A]">
                {professionName || "Profession assessment"}
              </h1>
              {statusBadge}
            </div>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#64748B]">{professionDescription}</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--brand-secondary)_12%,white)] text-[color:var(--brand-secondary)]">
                    <FileText className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 className="text-base font-semibold text-[#0F172A]">Basic Information</h2>
                </div>
                {professionIsActive ? activeStatusChip : inactiveStatusChip}
              </div>
              <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Profession Name</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">{professionName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Profession Code</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">{professionCode}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Industry</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">
                    {selectedIndustry?.label || selectedProfession?.industryKey || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Status</p>
                  <div className="mt-1">{professionIsActive ? activeStatusChip : inactiveStatusChip}</div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-[#94A3B8]">Description</p>
                  {canManage ? (
                    <textarea
                      rows={3}
                      value={professionProfile.description ?? ""}
                      disabled={!canManage}
                      onChange={(e) =>
                        updateProfessionProfile({ description: e.target.value || null })
                      }
                      placeholder="Describe this profession assessment…"
                      className={`mt-1 min-h-[4.5rem] py-2 leading-6 ${editorFieldClassName}`}
                    />
                  ) : (
                    <p className="mt-1 text-sm leading-6 text-[#0F172A]">{professionDescription}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Created</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">
                    {formatLongDate(selectedProfession?.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#94A3B8]">Last Updated</p>
                  <p className="mt-1 text-sm font-medium text-[#0F172A]">
                    {formatLongDate(draftUpdatedAt || selectedProfession?.updatedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-[#0F172A]">Additional Information</h2>
              <div className="mt-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">Department (optional)</span>
                  <input
                    value={professionProfile.department ?? ""}
                    disabled={!canManage}
                    onChange={(e) => updateProfessionProfile({ department: e.target.value || null })}
                    placeholder="e.g. IT Department"
                    className={fieldInputClassName}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">Level (optional)</span>
                  <input
                    value={professionProfile.level ?? ""}
                    disabled={!canManage}
                    onChange={(e) => updateProfessionProfile({ level: e.target.value || null })}
                    placeholder="e.g. Level 4"
                    className={fieldInputClassName}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">Employment Type (optional)</span>
                  <input
                    value={professionProfile.employmentType ?? ""}
                    disabled={!canManage}
                    onChange={(e) =>
                      updateProfessionProfile({ employmentType: e.target.value || null })
                    }
                    placeholder="e.g. 1099"
                    className={fieldInputClassName}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">
                    Typical Work Location (optional)
                  </span>
                  <input
                    value={professionProfile.workLocation ?? ""}
                    disabled={!canManage}
                    onChange={(e) =>
                      updateProfessionProfile({ workLocation: e.target.value || null })
                    }
                    placeholder="e.g. Onsite"
                    className={fieldInputClassName}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0F172A]">
              Skill Assessment{professionName ? ` · ${professionName}` : ""}
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Categories and questions applicants complete for this profession.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            <Link
              href={
                professionId
                  ? assessmentDetailHref(professionId)
                  : "/admin_recruiter/settings/assessment"
              }
              className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
            >
              Open full assessment
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge}
          {professionId && professionName ? (
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#475569]">
              Filtered · {professionName}
            </span>
          ) : null}
        </div>
      )}

      {!embedded ? (
        <>
          {!fullPage ? (
            <div className="space-y-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Enable Skill Assessment</p>
                  <p className="text-xs text-[#64748B]">When off, the step is hidden from applicants.</p>
                </div>
                <Toggle
                  checked={catalog.enabled}
                  disabled={!canManage}
                  label="Enable Skill Assessment"
                  onChange={(enabled) => updateCatalog((current) => ({ ...current, enabled }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">Allow Skip for Now</p>
                  <p className="text-xs text-[#64748B]">Let applicants skip the quiz and continue later.</p>
                </div>
                <Toggle
                  checked={catalog.allowSkip}
                  disabled={!canManage}
                  label="Allow Skip for Now"
                  onChange={(allowSkip) => updateCatalog((current) => ({ ...current, allowSkip }))}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white px-5 py-3 shadow-sm">
              <label className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
                <span className="font-medium">Enable assessment</span>
                <Toggle
                  checked={catalog.enabled}
                  disabled={!canManage}
                  label="Enable Skill Assessment"
                  onChange={(enabled) => updateCatalog((current) => ({ ...current, enabled }))}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[#0F172A]">
                <span className="font-medium">Allow skip</span>
                <Toggle
                  checked={catalog.allowSkip}
                  disabled={!canManage}
                  label="Allow Skip for Now"
                  onChange={(allowSkip) => updateCatalog((current) => ({ ...current, allowSkip }))}
                />
              </label>
            </div>
          )}

          <div
            className={
              fullPage
                ? "rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6"
                : "mt-5 space-y-3"
            }
          >
            <h4 className="text-base font-semibold text-[#0F172A]">Scoring</h4>
            <div
              className={
                fullPage
                  ? "mt-4 grid gap-4 md:grid-cols-2"
                  : "grid gap-3 md:grid-cols-2 lg:grid-cols-3"
              }
            >
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">Points per question</span>
                  <input
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={catalog.scoring.pointsPerQuestion}
                    onChange={(e) =>
                      updateCatalog((current) => ({
                        ...current,
                        scoring: { ...current.scoring, pointsPerQuestion: Number(e.target.value) || 0 },
                      }))
                    }
                    className={fieldInputClassName}
                  />
                </label>
                <label className="flex items-center gap-2.5 text-sm text-[#0F172A]">
                  <BrandCheckbox
                    disabled={!canManage}
                    checked={catalog.scoring.showOverallScore}
                    onChange={(checked) =>
                      updateCatalog((current) => ({
                        ...current,
                        scoring: { ...current.scoring, showOverallScore: checked },
                      }))
                    }
                  />
                  Overall assessment score
                </label>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#64748B]">Passing score (%)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!canManage}
                    value={passingScoreInput ?? String(catalog.scoring.passingScore)}
                    aria-invalid={scoreInvalid}
                    aria-describedby="passing-score-help"
                    onChange={(event) => {
                      const raw = event.target.value;
                      setPassingScoreInput(raw);
                      setScoreNotice(null);
                      if (/^\d+$/.test(raw) && Number(raw) <= 100) {
                        updateCatalog((current) => ({
                          ...current, scoring: { ...current.scoring, passingScore: Number(raw) },
                        }));
                      }
                    }}
                    onBlur={() => {
                      const raw = passingScoreInput ?? String(catalog.scoring.passingScore);
                      const parsed = Number(raw);
                      const score = raw.trim() && Number.isFinite(parsed)
                        ? Math.min(100, Math.max(0, Math.round(parsed))) : catalog.scoring.passingScore;
                      setPassingScoreInput(String(score));
                      setScoreNotice(String(score) !== raw ? `Passing score adjusted to ${score}%.` : null);
                      updateCatalog((current) => ({
                        ...current, scoring: { ...current.scoring, passingScore: score },
                      }));
                    }}
                    className={fieldInputClassName}
                  />
                  <span id="passing-score-help" className={`block text-xs ${scoreInvalid ? "text-red-600" : "text-[#64748B]"}`}>
                    Enter a whole number from 0 to 100.
                  </span>
                  {scoreNotice ? <span role="status" className="block text-xs text-[#64748B]">{scoreNotice}</span> : null}
                </label>
                <label className="flex items-center gap-2.5 text-sm text-[#0F172A]">
                  <BrandCheckbox
                    disabled={!canManage}
                    checked={catalog.scoring.scoreByCategory}
                    onChange={(checked) =>
                      updateCatalog((current) => ({
                        ...current,
                        scoring: { ...current.scoring, scoreByCategory: checked },
                      }))
                    }
                  />
                  Score by category
                </label>
              </div>
              <label
                className={`flex items-center gap-2.5 text-sm text-[#0F172A] ${fullPage ? "sm:col-span-2" : ""}`}
              >
                <BrandCheckbox
                  disabled={!canManage}
                  checked={catalog.scoring.showResultsToApplicant}
                  onChange={(checked) =>
                    updateCatalog((current) => ({
                      ...current,
                      scoring: { ...current.scoring, showResultsToApplicant: checked },
                    }))
                  }
                />
                Display results to applicants
              </label>
            </div>
          </div>
        </>
      ) : null}

      <div className={embedded ? "mt-1" : fullPage ? "space-y-3" : "mt-6"}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-[#0F172A]">
            {fullPage
              ? "Question Categories"
              : professionId
                ? `Categories for ${professionName || "this profession"}`
                : "Categories"}
          </h4>
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {professionId && visibleCategories.length === 0 ? (
                <button
                  type="button"
                  onClick={seedProfessionFromDefaults}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#012352]"
                >
                  Use default categories
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  updateCatalog((current) => ({
                    ...current,
                    categories: [
                      ...current.categories,
                      createEmptySkillCategory(current.categories.length + 1, professionId),
                    ],
                  }))
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-[color:var(--brand-secondary)] px-3 text-xs font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </button>
            </div>
          ) : null}
        </div>

        {visibleCategories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center">
            <p className="text-sm font-medium text-[#0F172A]">
              {professionId
                ? `No assessment categories for ${professionName || "this profession"} yet`
                : "No assessment categories yet"}
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              Add a category or start from the default skill assessment.
            </p>
          </div>
        ) : null}

        <ul className="space-y-2">
          {visibleCategories.map((category, index) => {
            const expanded = expandedCategoryId === category.id;
            const professionLabel =
              professions.find((row) => row.id === category.professionId)?.name ?? null;
            return (
              <li
                key={category.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const fromId = dragCategoryId.current;
                  if (!fromId || fromId === category.id) return;
                  reorderVisibleCategories(fromId, category.id);
                  dragCategoryId.current = null;
                }}
                className={
                  fullPage
                    ? "rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
                    : "rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]"
                }
              >
                <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <div
                    className={`flex min-w-0 flex-1 items-center gap-2 ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
                    draggable={canManage}
                    onDragStart={(event) => {
                      if (!canManage) return;
                      dragMovedRef.current = false;
                      dragCategoryId.current = category.id;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", category.id);
                    }}
                    onDrag={() => {
                      dragMovedRef.current = true;
                    }}
                    onDragEnd={() => {
                      dragCategoryId.current = null;
                    }}
                    onClick={() => {
                      if (dragMovedRef.current) {
                        dragMovedRef.current = false;
                        return;
                      }
                      setExpandedCategoryId(expanded ? null : category.id);
                    }}
                    role={canManage ? "button" : undefined}
                    aria-label={
                      canManage
                        ? `Drag to reorder ${category.name}, or click to ${expanded ? "collapse" : "expand"}`
                        : undefined
                    }
                  >
                    <span className="shrink-0 text-[#94A3B8]" aria-hidden>
                      <GripVertical className="h-4 w-4" />
                    </span>
                    {!fullPage ? (
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#64748B] transition ${expanded ? "" : "-rotate-90"}`}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate text-sm font-semibold text-[#0F172A]">
                      {index + 1}. {category.name}
                    </span>
                    {!category.isActive ? (
                      <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#B91C1C]">
                        Inactive
                      </span>
                    ) : null}
                    {professionLabel && !fullPage ? (
                      <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#1D4ED8]">
                        {professionLabel}
                      </span>
                    ) : !professionId && !fullPage ? (
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#64748B]">
                        Shared
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs text-[#94A3B8]">
                      {category.questions.length}{" "}
                      {category.questions.length === 1 ? "question" : "questions"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {canManage ? (
                      <>
                        <Toggle
                          checked={category.isActive}
                          label={`Active ${category.name}`}
                          onChange={(isActive) => updateCategory(category.id, { isActive })}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setConfirm({
                              title: "Delete category?",
                              message: `Delete “${category.name}” and its questions from this draft? Published applicant records are not deleted.`,
                              onConfirm: () => {
                                updateCatalog((current) => ({
                                  ...current,
                                  categories: current.categories.filter((row) => row.id !== category.id),
                                }));
                                if (expandedCategoryId === category.id) setExpandedCategoryId(null);
                                setConfirm(null);
                              },
                            })
                          }
                          className={
                            fullPage
                              ? "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
                              : "inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-white px-2 py-1 text-xs text-[#B91C1C]"
                          }
                          aria-label={`Delete ${category.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          {!fullPage ? "Delete" : null}
                        </button>
                      </>
                    ) : null}
                    {fullPage ? (
                      <button
                        type="button"
                        onClick={() => setExpandedCategoryId(expanded ? null : category.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC]"
                        aria-label={expanded ? `Collapse ${category.name}` : `Expand ${category.name}`}
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="space-y-3 border-t border-[#E2E8F0] bg-white px-3 py-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#64748B]">Category name</span>
                        <input
                          value={category.name}
                          disabled={!canManage}
                          onChange={(e) => updateCategory(category.id, { name: e.target.value })}
                          className={`h-9 ${editorFieldClassName}`}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#64748B]">Display order</span>
                        <input
                          type="number"
                          min={1}
                          value={category.sortOrder}
                          disabled={!canManage}
                          onChange={(e) => updateCategory(category.id, { sortOrder: Number(e.target.value) || 1 })}
                          className={`h-9 ${editorFieldClassName}`}
                        />
                      </label>
                      {!professionId ? (
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-xs font-semibold text-[#64748B]">Profession</span>
                          <select
                            value={category.professionId ?? ""}
                            disabled={!canManage}
                            onChange={(e) =>
                              updateCategory(category.id, {
                                professionId: e.target.value.trim() || null,
                              })
                            }
                            className={`h-9 ${editorFieldClassName}`}
                          >
                            <option value="">Shared (all professions)</option>
                            {professions.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-xs font-semibold text-[#64748B]">Short description</span>
                        <input
                          value={category.description ?? ""}
                          disabled={!canManage}
                          onChange={(e) => updateCategory(category.id, { description: e.target.value })}
                          className={`h-9 ${editorFieldClassName}`}
                        />
                      </label>
                      <label className="block space-y-1 sm:col-span-2">
                        <span className="text-xs font-semibold text-[#64748B]">Optional instructions</span>
                        <textarea
                          value={category.instructions ?? ""}
                          disabled={!canManage}
                          onChange={(e) => updateCategory(category.id, { instructions: e.target.value || null })}
                          className={`min-h-16 py-2 ${editorFieldClassName}`}
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#0F172A]">Questions</p>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            const created = createEmptySkillQuestion(category.questions.length + 1);
                            updateCatalog((current) => ({
                              ...current,
                              categories: current.categories.map((row) =>
                                row.id === category.id
                                  ? { ...row, questions: [...row.questions, created] }
                                  : row
                              ),
                            }));
                            setEditingQuestionId(created.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#012352]"
                        >
                          <Plus className="h-3 w-3" />
                          Add question
                        </button>
                      ) : null}
                    </div>

                    <ul className="space-y-2">
                      {category.questions.map((question, questionIndex) => (
                        <li
                          key={question.id}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            const fromId = dragQuestionId.current;
                            if (!fromId || fromId === question.id) return;
                            updateCatalog((current) => ({
                              ...current,
                              categories: current.categories.map((row) =>
                                row.id === category.id
                                  ? {
                                      ...row,
                                      questions: reorderItems(row.questions, fromId, question.id).map(
                                        (item, order) => ({ ...item, sortOrder: order + 1 })
                                      ),
                                    }
                                  : row
                              ),
                            }));
                            dragQuestionId.current = null;
                          }}
                          className="rounded-md border border-[#E2E8F0] px-2 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className={`flex min-w-0 flex-1 items-start gap-2 ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
                              draggable={canManage}
                              onDragStart={(event) => {
                                if (!canManage) return;
                                dragQuestionId.current = question.id;
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", question.id);
                              }}
                              onDragEnd={() => {
                                dragQuestionId.current = null;
                              }}
                              aria-label={canManage ? `Drag to reorder question ${questionIndex + 1}` : undefined}
                            >
                              {canManage ? (
                                <span className="mt-0.5 shrink-0 text-[#94A3B8]" aria-hidden>
                                  <GripVertical className="h-4 w-4" />
                                </span>
                              ) : null}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#0F172A]">
                                  {questionIndex + 1}. {question.text}
                                </p>
                                <p className="text-xs text-[#64748B]">
                                  {QUESTION_TYPE_LABELS[question.type]} · {question.required ? "Required" : "Optional"} · {question.points} pts
                                </p>
                              </div>
                            </div>
                            {canManage ? (
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingQuestionId(editingQuestionId === question.id ? null : question.id)
                                  }
                                  className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155]"
                                >
                                  <Pencil className="mr-1 inline h-3 w-3" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = duplicateSkillQuestion(question, category.questions.length + 1);
                                    updateCatalog((current) => ({
                                      ...current,
                                      categories: current.categories.map((row) =>
                                        row.id === category.id
                                          ? { ...row, questions: [...row.questions, copy] }
                                          : row
                                      ),
                                    }));
                                    setEditingQuestionId(copy.id);
                                  }}
                                  className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155]"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirm({
                                      title: "Delete question?",
                                      message: `Delete “${question.text}” from this draft? Previously completed answers are kept.`,
                                      onConfirm: () => {
                                        updateCatalog((current) => ({
                                          ...current,
                                          categories: current.categories.map((row) =>
                                            row.id === category.id
                                              ? {
                                                  ...row,
                                                  questions: row.questions.filter((item) => item.id !== question.id),
                                                }
                                              : row
                                          ),
                                        }));
                                        setConfirm(null);
                                      },
                                    })
                                  }
                                  className="rounded-md border border-[#FECACA] bg-white px-2 py-1 text-xs text-[#B91C1C]"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                          {editingQuestionId === question.id ? (
                            <QuestionEditor
                              question={question}
                              disabled={!canManage}
                              onChange={(next) => updateQuestion(category.id, next)}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className={
          fullPage
            ? "fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur sm:px-6"
            : "mt-6 flex flex-col gap-2 border-t border-[#E2E8F0] pt-4 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div
          className={
            fullPage
              ? "mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              : "contents"
          }
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#012352]"
          >
            <Eye className="h-4 w-4" />
            {fullPage ? "Preview Questionnaires" : "Preview Applicant Experience"}
          </button>
          {canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={saving}
                onClick={cancelEdits}
                className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#012352] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || scoreInvalid}
                onClick={() => void saveDraft()}
                className="h-10 rounded-lg border border-[color:var(--brand-secondary)] bg-white px-4 text-sm font-medium text-[color:var(--brand-secondary)] disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving || scoreInvalid}
                onClick={() => void publish()}
                className="h-10 rounded-lg bg-[color:var(--brand-secondary)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {fullPage ? "Publish" : "Publish Changes"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">Only administrators can edit assessment settings.</p>
          )}
        </div>
      </div>

      {previewOpen && previewCatalog ? (
        <AssessmentPreviewModal catalog={previewCatalog} onClose={() => setPreviewOpen(false)} />
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.onConfirm}
        />
      ) : null}
    </section>
  );
}
