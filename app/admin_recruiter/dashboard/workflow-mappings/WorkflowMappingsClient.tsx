"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { BulkDeleteConfirmModal } from "@/app/admin_recruiter/components/BulkDeleteConfirmModal";
import type { EmploymentType } from "@/lib/jobs/types";

type MappingItem = {
  id: string;
  professionId: string | null;
  professionName: string | null;
  specialtyId: string | null;
  specialtyName: string | null;
  employmentType: EmploymentType;
  location: string | null;
  locationType: string | null;
  yearsOfExperience: string | null;
  workflowId: string;
  workflowName: string;
  workflowEmploymentType: string | null;
  isActive: boolean;
  priority: number;
  specificity: number;
};

type OptionsPayload = {
  professions: Array<{ id: string; name: string }>;
  specialties: Array<{ id: string; name: string; profession_id: string }>;
  employmentTypes: EmploymentType[];
  locationTypes: string[];
  workflows: Array<{ id: string; name: string; employment_type?: string | null }>;
};

type FormState = {
  id?: string;
  professionId: string;
  employmentType: EmploymentType;
  location: string;
  locationType: string;
  workflowId: string;
  priority: number;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  professionId: "",
  employmentType: "W2",
  location: "",
  locationType: "",
  workflowId: "",
  priority: 100,
  isActive: true,
});

const SELECT_CHEVRON =
  "appearance-none pr-10 [background-image:url('/icons/applicants/icon-chevron-down.svg')] [background-size:12px_12px] [background-position:right_12px_center] [background-repeat:no-repeat]";

const selectClass = `w-full ${SELECT_CHEVRON} rounded-lg border border-[#D1D5DB] bg-white py-2.5 pl-3 text-sm text-[#111827] outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_15%,transparent)]`;

const modalInputClass =
  "w-full rounded-lg border border-[color-mix(in_srgb,var(--brand-primary)_40%,#D1D5DB)] bg-white px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_15%,transparent)]";

const modalSelectClass = `${modalInputClass} ${SELECT_CHEVRON} pl-3`;

function employmentLabel(type: EmploymentType): string {
  return type === "Contract" ? "RNR" : type;
}

function isProfessionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function criteriaSummary(mapping: MappingItem): string {
  const parts = [employmentLabel(mapping.employmentType)];
  if (mapping.professionName) parts.push(mapping.professionName);
  else parts.push("Any profession");
  if (mapping.specialtyName) parts.push(mapping.specialtyName);
  if (mapping.locationType) parts.push(mapping.locationType);
  if (mapping.location) parts.push(mapping.location);
  if (mapping.yearsOfExperience) parts.push(`${mapping.yearsOfExperience} yrs`);
  return parts.join(" + ");
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.155 2.488a1.667 1.667 0 0 1 2.357 2.357L5.333 11.999H3v-2.333l7.155-7.178Z"
        stroke="#667085"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.333 3.333 12 6" stroke="#667085" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.333 4.667h9.334" stroke="#667085" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M6 4.667V3.333A.667.667 0 0 1 6.667 2.667h2.666A.667.667 0 0 1 10 3.333v1.334"
        stroke="#667085"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12.333 4.667v8a1.333 1.333 0 0 1-1.333 1.333H5a1.333 1.333 0 0 1-1.333-1.333v-8"
        stroke="#667085"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function WorkflowMappingsClient({
  embedded = false,
  openCreateSignal = 0,
}: {
  embedded?: boolean;
  /** Increment from the Workflows hub “Create Mapping” button. */
  openCreateSignal?: number;
} = {}) {
  const searchParams = useSearchParams();
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [options, setOptions] = useState<OptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterProfession, setFilterProfession] = useState("");
  const [filterEmployment, setFilterEmployment] = useState("");
  const [pendingDelete, setPendingDelete] = useState<MappingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const lastCreateSignalRef = useRef(0);

  const loadMappings = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterProfession) params.set("professionId", filterProfession);
    if (filterEmployment) params.set("employmentType", filterEmployment);
    const response = await fetch(`/api/admin/workflow-mappings?${params}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load mappings");
    setMappings(payload.mappings ?? []);
  }, [filterProfession, filterEmployment]);

  const loadOptions = useCallback(async (employmentType?: string) => {
    const params = employmentType ? `?employmentType=${encodeURIComponent(employmentType)}` : "";
    const response = await fetch(`/api/admin/workflow-mappings/options${params}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load options");
    setOptions(payload);
  }, []);

  useEffect(() => {
    void Promise.all([loadMappings(), loadOptions()])
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load page"))
      .finally(() => setLoading(false));
  }, [loadMappings, loadOptions]);

  function openCreate(prefill?: Partial<FormState>) {
    setForm({ ...emptyForm(), ...prefill });
    setFormOpen(true);
  }

  useEffect(() => {
    if (!openCreateSignal || openCreateSignal === lastCreateSignalRef.current) return;
    lastCreateSignalRef.current = openCreateSignal;
    openCreate();
  }, [openCreateSignal]);

  useEffect(() => {
    const professionId = searchParams.get("professionId");
    const employmentType = searchParams.get("employmentType") as EmploymentType | null;
    const workflowId = searchParams.get("workflowId");
    if (professionId || employmentType || workflowId) {
      setFilterProfession(professionId && isProfessionId(professionId) ? professionId : "");
      setFilterEmployment(employmentType ?? "");
      openCreate({
        professionId: professionId ?? "",
        employmentType: employmentType ?? "W2",
        workflowId: workflowId ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    void loadOptions(form.employmentType).catch(() => undefined);
  }, [form.employmentType, formOpen, loadOptions]);

  function openEdit(mapping: MappingItem) {
    setForm({
      id: mapping.id,
      professionId: mapping.professionId ?? "",
      employmentType: mapping.employmentType,
      location: mapping.location ?? "",
      locationType: mapping.locationType ?? "",
      workflowId: mapping.workflowId,
      priority: mapping.priority,
      isActive: mapping.isActive,
    });
    setFormOpen(true);
  }

  async function saveMapping() {
    setSaving(true);
    try {
      const body = {
        id: form.id,
        professionId: form.professionId || null,
        specialtyId: null,
        employmentType: form.employmentType,
        location: form.location || null,
        locationType: form.locationType || null,
        yearsOfExperience: null,
        workflowId: form.workflowId,
        priority: form.priority,
        isActive: form.isActive,
      };
      const response = await fetch(
        form.id ? `/api/admin/workflow-mappings/${form.id}` : "/api/admin/workflow-mappings",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save mapping");
      toast.success(form.id ? "Mapping updated" : "Mapping created");
      setFormOpen(false);
      await Promise.all([loadMappings(), loadOptions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  function requestRemoveMapping(mapping: MappingItem) {
    setDeleteError(null);
    setPendingDelete(mapping);
  }

  async function confirmRemoveMapping() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/admin/workflow-mappings/${pendingDelete.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to delete mapping");
      toast.success(
        payload.deactivated
          ? "Mapping deactivated (jobs still reference workflow)"
          : "Mapping deleted"
      );
      setPendingDelete(null);
      await loadMappings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete mapping";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const filters = (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="block w-full text-sm sm:w-[220px]">
        <span className="mb-1 block text-xs font-medium text-[#667085]">Filter profession</span>
        <select
          className={selectClass}
          value={filterProfession}
          onChange={(e) => setFilterProfession(e.target.value)}
        >
          <option value="">All professions</option>
          {options?.professions
            .filter((item) => isProfessionId(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block w-full text-sm sm:w-[220px]">
        <span className="mb-1 block text-xs font-medium text-[#667085]">Filter employment type</span>
        <select
          className={selectClass}
          value={filterEmployment}
          onChange={(e) => setFilterEmployment(e.target.value)}
        >
          <option value="">All employment types</option>
          {options?.employmentTypes.map((value) => (
            <option key={value} value={value}>
              {employmentLabel(value)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const table = (
    <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="border-b border-[#E4E7EC] px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold text-[#101828]">Mappings</h2>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-[#667085]">Loading mappings…</p>
      ) : mappings.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-medium text-[#344054]">No workflow mappings configured yet.</p>
          <p className="mt-1 text-sm text-[#667085]">
            Create an employment-type default or a specific attribute combination so jobs assign
            workflows automatically.
          </p>
          <button
            type="button"
            onClick={() => openCreate()}
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Create Mapping
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F9FAFB]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] sm:px-5">
                  Criteria
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-[#667085]">
                  Specificity
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-[#667085]">Workflow</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-[#667085]">Priority</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-[#667085]">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#667085] sm:px-5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr
                  key={mapping.id}
                  className="border-t border-[#F2F4F7] transition hover:bg-[#FCFCFD]"
                >
                  <td className="px-4 py-4 font-medium text-[#101828] sm:px-5">
                    {criteriaSummary(mapping)}
                  </td>
                  <td className="px-3 py-4 text-center text-[#475467]">{mapping.specificity}</td>
                  <td className="px-3 py-4 text-left font-medium text-[#101828]">
                    {mapping.workflowName}
                  </td>
                  <td className="px-3 py-4 text-center text-[#475467]">{mapping.priority}</td>
                  <td className="px-3 py-4 text-center">
                    {mapping.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-[#EFF8FF] px-2.5 py-0.5 text-xs font-medium text-[#175CD3]">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-xs font-medium text-[#667085]">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(mapping)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F2F4F7]"
                        aria-label={`Edit mapping ${criteriaSummary(mapping)}`}
                        title="Edit"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestRemoveMapping(mapping)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#FEF3F2]"
                        aria-label={`Delete mapping ${criteriaSummary(mapping)}`}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const formModal = formOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold text-[#111827]">
          {form.id ? "Edit workflow mapping" : "Create workflow mapping"}
        </h2>
        <p className="mt-1 text-xs text-[#6B7280]">
          Leave optional fields blank to match any value. Employment type alone creates a default
          mapping for that type.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">Employment type</span>
            <select
              className={modalSelectClass}
              value={form.employmentType}
              onChange={(e) =>
                setForm((c) => ({
                  ...c,
                  employmentType: e.target.value as EmploymentType,
                  workflowId: "",
                }))
              }
            >
              {options?.employmentTypes.map((value) => (
                <option key={value} value={value}>
                  {employmentLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">
              Profession (optional)
            </span>
            <select
              className={modalSelectClass}
              value={form.professionId}
              onChange={(e) => setForm((c) => ({ ...c, professionId: e.target.value }))}
            >
              <option value="">Any profession</option>
              {options?.professions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">
              Location type (optional)
            </span>
            <select
              className={modalSelectClass}
              value={form.locationType}
              onChange={(e) => setForm((c) => ({ ...c, locationType: e.target.value }))}
            >
              <option value="">Any location type</option>
              {(options?.locationTypes ?? ["On-site", "Remote", "Hybrid"]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">
              Job location (optional)
            </span>
            <input
              className={modalInputClass}
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
              placeholder="e.g. Dallas, TX"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">
              Published workflow
            </span>
            <select
              className={modalSelectClass}
              value={form.workflowId}
              onChange={(e) => setForm((c) => ({ ...c, workflowId: e.target.value }))}
            >
              <option value="">Select published workflow</option>
              {options?.workflows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[#374151]">
              Priority (lower wins ties)
            </span>
            <input
              className={modalInputClass}
              type="number"
              min={0}
              value={form.priority}
              onChange={(e) => setForm((c) => ({ ...c, priority: Number(e.target.value) }))}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-[#374151]">
            <span
              className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition"
              style={{
                borderColor: form.isActive
                  ? "var(--brand-secondary, var(--brand-primary))"
                  : "#D1D5DB",
                backgroundColor: form.isActive
                  ? "var(--brand-secondary, var(--brand-primary))"
                  : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              {form.isActive ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="font-medium">Active mapping</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="rounded-lg border border-[#D1D5DB] px-4 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.workflowId}
            onClick={() => void saveMapping()}
            className="rounded-lg bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Mapping"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const deleteModal = (
    <BulkDeleteConfirmModal
      open={pendingDelete !== null}
      busy={deleting}
      error={deleteError}
      title="Delete mapping?"
      description={
        pendingDelete ? (
          <p>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#101828]">
              {criteriaSummary(pendingDelete)}
            </span>
            ? This action cannot be undone.
          </p>
        ) : null
      }
      onCancel={() => {
        if (deleting) return;
        setPendingDelete(null);
        setDeleteError(null);
      }}
      onConfirm={() => void confirmRemoveMapping()}
    />
  );

  if (embedded) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        {filters}
        {table}
        {formModal}
        {deleteModal}
      </div>
    );
  }

  return (
    <main className="w-full min-w-0 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-7 text-[#101828] sm:text-2xl">Mappings</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#667085]">
            Create and manage automated workflows to streamline daily tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#101828] px-5 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
        >
          Create Mapping
        </button>
      </div>

      {filters}
      {table}
      {formModal}
      {deleteModal}

      <p className="mt-4 text-sm text-[#667085]">
        Need a workflow first?{" "}
        <Link
          href="/admin_recruiter/dashboard/onboarding-flows"
          className="font-medium text-[color:var(--brand-primary)] hover:underline"
        >
          Publish a workflow
        </Link>{" "}
        or start from{" "}
        <Link
          href="/admin_recruiter/dashboard/onboarding-flows?tab=templates"
          className="font-medium text-[color:var(--brand-primary)] hover:underline"
        >
          Templates
        </Link>
        .
      </p>
    </main>
  );
}
