"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import type { EmploymentType } from "@/lib/jobs/types";

type MappingItem = {
  id: string;
  professionId: string;
  professionName: string;
  employmentType: EmploymentType;
  workflowId: string;
  workflowName: string;
  workflowEmploymentType: string | null;
  isActive: boolean;
  priority: number;
};

type OptionsPayload = {
  professions: Array<{ id: string; name: string }>;
  employmentTypes: EmploymentType[];
  workflows: Array<{ id: string; name: string; employment_type?: string | null }>;
};

type FormState = {
  id?: string;
  professionId: string;
  employmentType: EmploymentType;
  workflowId: string;
  priority: number;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  professionId: "",
  employmentType: "W2",
  workflowId: "",
  priority: 100,
  isActive: true,
});

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function WorkflowMappingsClient() {
  const searchParams = useSearchParams();
  const [mappings, setMappings] = useState<MappingItem[]>([]);
  const [options, setOptions] = useState<OptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [filterProfession, setFilterProfession] = useState("");
  const [filterEmployment, setFilterEmployment] = useState("");

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

  const conflicts = useMemo(() => {
    const activeKeys = new Map<string, string>();
    const duplicateIds = new Set<string>();
    for (const mapping of mappings) {
      if (!mapping.isActive) continue;
      const key = `${mapping.professionId}:${mapping.employmentType}`;
      if (activeKeys.has(key)) duplicateIds.add(mapping.id);
      else activeKeys.set(key, mapping.id);
    }
    return duplicateIds;
  }, [mappings]);

  function openCreate(prefill?: Partial<FormState>) {
    setForm({ ...emptyForm(), ...prefill });
    setFormOpen(true);
  }

  useEffect(() => {
    const professionId = searchParams.get("professionId");
    const employmentType = searchParams.get("employmentType") as EmploymentType | null;
    const workflowId = searchParams.get("workflowId");
    if (professionId || employmentType || workflowId) {
      setFilterProfession(professionId ?? "");
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
      professionId: mapping.professionId,
      employmentType: mapping.employmentType,
      workflowId: mapping.workflowId,
      priority: mapping.priority,
      isActive: mapping.isActive,
    });
    setFormOpen(true);
  }

  async function saveMapping() {
    setSaving(true);
    try {
      const response = await fetch(
        form.id ? `/api/admin/workflow-mappings/${form.id}` : "/api/admin/workflow-mappings",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save mapping");
      toast.success(form.id ? "Mapping updated" : "Mapping created");
      setFormOpen(false);
      await loadMappings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mapping");
    } finally {
      setSaving(false);
    }
  }

  async function removeMapping(mapping: MappingItem) {
    if (!window.confirm(`Remove mapping for ${mapping.professionName} + ${mapping.employmentType}?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/workflow-mappings/${mapping.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to delete mapping");
      toast.success(
        payload.deactivated
          ? "Mapping deactivated (jobs still reference workflow)"
          : "Mapping deleted"
      );
      await loadMappings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete mapping");
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Automation</p>
          <h1 className="text-2xl font-semibold text-slate-900">Workflow Mappings</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Connect profession and employment type to a published tenant workflow. Jobs and applicants
            resolve workflows from these mappings automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Create Mapping
        </button>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter profession</span>
            <select
              className={inputClass}
              value={filterProfession}
              onChange={(e) => setFilterProfession(e.target.value)}
            >
              <option value="">All professions</option>
              {options?.professions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Filter employment type</span>
            <select
              className={inputClass}
              value={filterEmployment}
              onChange={(e) => setFilterEmployment(e.target.value)}
            >
              <option value="">All employment types</option>
              {options?.employmentTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading mappings…</p>
        ) : mappings.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-600">No workflow mappings configured yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Publish a tenant workflow, then create a mapping so jobs can assign it automatically.
            </p>
            <button
              type="button"
              onClick={() => openCreate()}
              className="mt-4 rounded-lg border border-teal-200 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              Create first mapping
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Profession</th>
                  <th className="px-4 py-3">Employment</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{mapping.professionName}</td>
                    <td className="px-4 py-3">{mapping.employmentType}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{mapping.workflowName}</span>
                      {mapping.workflowEmploymentType ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Workflow type: {mapping.workflowEmploymentType}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{mapping.priority}</td>
                    <td className="px-4 py-3">
                      {conflicts.has(mapping.id) ? (
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                          Conflict
                        </span>
                      ) : mapping.isActive ? (
                        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(mapping)}
                          className="text-teal-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeMapping(mapping)}
                          className="text-rose-700 hover:underline"
                        >
                          Delete
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

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {form.id ? "Edit workflow mapping" : "Create workflow mapping"}
            </h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Profession</span>
                <select
                  className={inputClass}
                  value={form.professionId}
                  onChange={(e) => setForm((c) => ({ ...c, professionId: e.target.value }))}
                >
                  <option value="">Select profession</option>
                  {options?.professions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Employment type</span>
                <select
                  className={inputClass}
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
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Published workflow</span>
                <select
                  className={inputClass}
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
                <span className="mb-1 block font-medium text-slate-700">Priority</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) => setForm((c) => ({ ...c, priority: Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                />
                Active mapping
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !form.professionId || !form.workflowId}
                onClick={() => void saveMapping()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Mapping"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-slate-500">
        Need a workflow first?{" "}
        <Link
          href="/admin_recruiter/dashboard/onboarding-flows"
          className="font-medium text-teal-700 hover:underline"
        >
          Publish a workflow
        </Link>{" "}
        or start from{" "}
        <Link
          href="/admin_recruiter/dashboard/templates"
          className="font-medium text-teal-700 hover:underline"
        >
          My Templates
        </Link>
        .
      </p>
    </main>
  );
}
