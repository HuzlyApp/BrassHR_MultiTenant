"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, Children, isValidElement } from "react";
import {
  Briefcase,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  assessmentDetailHref,
} from "@/app/admin_recruiter/settings/assessment-routes";
import { professionDetailHref } from "@/app/admin_recruiter/settings/ProfessionDocumentsPanel";
import { normalizeSkillAssessmentCatalog } from "@/lib/skill-assessment/catalog";

export { assessmentDetailHref } from "@/app/admin_recruiter/settings/assessment-routes";

type ProfessionRow = {
  id: string;
  name: string;
  catalogKey: string | null;
  industryKey: string | null;
};

type IndustryOption = {
  key: string;
  label: string;
  isPrimary?: boolean;
};

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
  return INDUSTRY_TAGLINES[key] ?? `Evaluate skills for ${label} roles.`;
}

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

const fieldClassName =
  "h-9 w-full cursor-pointer appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC]";

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)]";

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
          className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
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

export default function AssessmentListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProfessionId = searchParams.get("profession")?.trim() || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [assessmentLabelByProfession, setAssessmentLabelByProfession] = useState<
    Record<string, string>
  >({});

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [industryFilterKey, setIndustryFilterKey] = useState<string>("all");
  const [professionFilterId, setProfessionFilterId] = useState<string>("all");
  const [selectedIndustryKey, setSelectedIndustryKey] = useState<string | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!queryProfessionId) return;
    router.replace(assessmentDetailHref(queryProfessionId));
  }, [queryProfessionId, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [professionsRes, assessmentRes] = await Promise.all([
        fetch("/api/admin/profession-documents", { cache: "no-store" }),
        fetch("/api/admin/assessment-settings", { cache: "no-store" }),
      ]);
      const professionsPayload = (await professionsRes.json()) as {
        error?: string;
        industryKey?: string | null;
        industryLabel?: string | null;
        industries?: IndustryOption[];
        professions?: Array<{
          id: string;
          name: string;
          catalogKey?: string | null;
          industryKey?: string | null;
        }>;
      };
      if (!professionsRes.ok) {
        throw new Error(professionsPayload.error || "Could not load professions");
      }

      const nextIndustries =
        professionsPayload.industries && professionsPayload.industries.length > 0
          ? professionsPayload.industries
          : professionsPayload.industryKey
            ? [
                {
                  key: professionsPayload.industryKey,
                  label: professionsPayload.industryLabel ?? professionsPayload.industryKey,
                  isPrimary: true,
                },
              ]
            : [];

      const rows: ProfessionRow[] = (professionsPayload.professions ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        catalogKey: row.catalogKey ?? null,
        industryKey: row.industryKey ?? null,
      }));

      setIndustries(nextIndustries);
      setProfessions(rows);
      setSelectedIndustryKey((current) => {
        if (current && nextIndustries.some((row) => row.key === current)) return current;
        return nextIndustries[0]?.key ?? null;
      });
      setIndustryFilterKey((current) =>
        current !== "all" && nextIndustries.some((row) => row.key === current) ? current : "all"
      );

      if (assessmentRes.ok) {
        const assessmentPayload = (await assessmentRes.json().catch(() => ({}))) as {
          settings?: { draft?: unknown };
        };
        const draft = normalizeSkillAssessmentCatalog(assessmentPayload.settings?.draft);
        const labels: Record<string, string> = {};
        for (const category of draft.categories) {
          const professionId = category.professionId?.trim();
          const name = category.name?.trim();
          if (professionId && name && !labels[professionId]) labels[professionId] = name;
        }
        setAssessmentLabelByProfession(labels);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assessment list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!rowMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
        setRowMenuId(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId]);

  const selectedIndustry =
    industries.find((row) => row.key === selectedIndustryKey) ??
    industries.find((row) => row.key === industryFilterKey) ??
    industries[0] ??
    null;

  const professionOptionsForFilter = useMemo(() => {
    if (industryFilterKey === "all") return professions;
    return professions.filter((row) => (row.industryKey || "other") === industryFilterKey);
  }, [professions, industryFilterKey]);

  useEffect(() => {
    if (professionFilterId === "all") return;
    if (!professionOptionsForFilter.some((row) => row.id === professionFilterId)) {
      setProfessionFilterId("all");
    }
  }, [professionFilterId, professionOptionsForFilter]);

  useEffect(() => {
    if (industryFilterKey === "all") return;
    setSelectedIndustryKey(industryFilterKey);
  }, [industryFilterKey]);

  const filteredRows = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();
    return professions.filter((profession) => {
      const industryKey = profession.industryKey || "other";
      if (industryFilterKey !== "all" && industryKey !== industryFilterKey) return false;
      if (professionFilterId !== "all" && profession.id !== professionFilterId) return false;

      if (!query) return true;
      const industry = industries.find((row) => row.key === industryKey);
      const index = professions.findIndex((row) => row.id === profession.id);
      const code = professionCode(profession, index, industry?.label ?? null).toLowerCase();
      return (
        profession.name.toLowerCase().includes(query) ||
        code.includes(query) ||
        (industry?.label ?? "").toLowerCase().includes(query) ||
        industryKey.toLowerCase().includes(query)
      );
    });
  }, [
    professions,
    industries,
    industryFilterKey,
    professionFilterId,
    appliedSearch,
  ]);

  function applySearch(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    setAppliedSearch(searchInput);
    if (industryFilterKey !== "all") {
      setSelectedIndustryKey(industryFilterKey);
    } else {
      const match = industries.find(
        (industry) =>
          industry.label.toLowerCase().includes(searchInput.trim().toLowerCase()) ||
          industry.key.toLowerCase().includes(searchInput.trim().toLowerCase())
      );
      if (match) setSelectedIndustryKey(match.key);
    }
  }

  if (loading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 rounded-lg bg-[#E5E7EB] motion-safe:animate-pulse" />
        <div className="h-11 max-w-xl rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        <div className="h-40 rounded-2xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Assessment</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Evaluate candidates&apos; skills with profession-linked assessments.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={applySearch}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
            aria-hidden
          />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search Industry"
            aria-label="Search Industry"
            className={`${inputClassName} h-11 rounded-xl pl-9`}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-primary,#012352)] px-5 text-sm font-medium text-white hover:brightness-95"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          label="Filter by industry"
          value={industryFilterKey}
          onChange={(event) => setIndustryFilterKey(event.target.value || "all")}
          className="w-full sm:w-[220px]"
        >
          <option value="all">All Industry</option>
          {industries.map((industry) => (
            <option key={industry.key} value={industry.key}>
              {industry.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Filter by profession"
          value={professionFilterId}
          onChange={(event) => setProfessionFilterId(event.target.value || "all")}
          className="w-full sm:w-[220px]"
        >
          <option value="all">All Professions</option>
          {professionOptionsForFilter.map((profession) => (
            <option key={profession.id} value={profession.id}>
              {profession.name}
            </option>
          ))}
        </SelectField>
      </div>

      {selectedIndustry ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#012352]">
              <Briefcase className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-[#0F172A]">
                {selectedIndustry.label}
              </h2>
              <p className="mt-0.5 text-sm leading-5 text-[#64748B]">
                {industryTagline(selectedIndustry.key, selectedIndustry.label)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm shadow-slate-900/[0.03]">
        {filteredRows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-medium text-[#0F172A]">No professions found</p>
            <p className="mt-1 text-sm text-[#64748B]">
              {professions.length === 0
                ? "Add professions under Settings → Professions to link assessments."
                : "Try a different search or filter."}
            </p>
            {professions.length === 0 ? (
              <Link
                href="/admin_recruiter/settings/profession"
                className="mt-4 inline-flex text-sm font-medium text-[#012352] hover:underline"
              >
                Open Professions
              </Link>
            ) : null}
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
                {filteredRows.map((profession, rowIndex) => {
                  const globalIndex = professions.findIndex((row) => row.id === profession.id);
                  const industry = industries.find(
                    (row) => row.key === (profession.industryKey || "other")
                  );
                  const code = professionCode(
                    profession,
                    globalIndex >= 0 ? globalIndex : rowIndex,
                    industry?.label ?? null
                  );
                  const assessmentLabel =
                    assessmentLabelByProfession[profession.id] ?? "—";
                  return (
                    <tr
                      key={profession.id}
                      className="border-t border-[#F1F5F9] bg-white"
                      onMouseEnter={() => {
                        if (profession.industryKey) setSelectedIndustryKey(profession.industryKey);
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{code}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={assessmentDetailHref(profession.id)}
                          className="text-sm font-medium text-[#C2410C] hover:underline"
                        >
                          {profession.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {assessmentLabel !== "—" ? (
                          <div className="min-w-0">
                            <Link
                              href={assessmentDetailHref(profession.id)}
                              className="text-sm font-medium text-[#C2410C] hover:underline"
                              title={assessmentLabel}
                            >
                              View Assessment
                            </Link>
                            <p
                              className="mt-0.5 truncate text-xs text-[#64748B]"
                              title={assessmentLabel}
                            >
                              {assessmentLabel}
                            </p>
                          </div>
                        ) : (
                          <Link
                            href={assessmentDetailHref(profession.id)}
                            className="text-sm font-medium text-[#C2410C] hover:underline"
                          >
                            Configure
                          </Link>
                        )}
                      </td>
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
                            <div className="absolute right-0 top-9 z-50 min-w-[180px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                              <Link
                                href={assessmentDetailHref(profession.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                                onClick={() => setRowMenuId(null)}
                              >
                                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                                Open assessment
                              </Link>
                              <Link
                                href={professionDetailHref(profession.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                                onClick={() => setRowMenuId(null)}
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                View documents
                              </Link>
                              <Link
                                href={professionDetailHref(profession.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                                onClick={() => setRowMenuId(null)}
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                Profession detail
                              </Link>
                            </div>
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
      </div>
    </section>
  );
}
