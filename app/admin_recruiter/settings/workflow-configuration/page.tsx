"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MappingRow = {
  id: string;
  job_role: string | null;
  employment_type: string | null;
  placement_type: string | null;
  workflow_template_id: string;
  workflow_name: string | null;
  workflow_status: string | null;
  priority: number;
  is_active: boolean;
  jobs_using_workflow: number;
  created_at: string;
  updated_at: string;
};

type FlowOption = {
  id: string;
  name: string;
  status: string;
  is_active?: boolean;
  is_master_template?: boolean;
};

export default function WorkflowConfigurationPage() {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [defaultWorkflowId, setDefaultWorkflowId] = useState("");
  const [priorityGuide, setPriorityGuide] = useState<string[]>([]);
  const [jobRole, setJobRole] = useState("");
  const [employmentType, setEmploymentType] = useState("W2");
  const [placementType, setPlacementType] = useState("Internal");
  const [workflowTemplateId, setWorkflowTemplateId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/workflow-mappings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load mappings");
      setMappings(json.mappings ?? []);
      setFlows(json.flows ?? []);
      setDefaultWorkflowId(json.defaultWorkflowTemplateId ?? "");
      setPriorityGuide(json.priorityGuide ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflow configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMapping(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/workflow-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobRole: jobRole || null,
        employmentType: employmentType || null,
        placementType: placementType || null,
        workflowTemplateId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save mapping");
      return;
    }
    setJobRole("");
    setWorkflowTemplateId("");
    setNotice("Mapping saved.");
    await load();
  }

  async function saveDefault() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/workflow-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_default",
        defaultWorkflowTemplateId: defaultWorkflowId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save default workflow");
      return;
    }
    setNotice("Tenant default workflow updated.");
    await load();
  }

  async function toggleActive(row: MappingRow) {
    const res = await fetch(`/api/admin/workflow-mappings/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.is_active }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update mapping");
      return;
    }
    await load();
  }

  async function removeMapping(row: MappingRow) {
    const res = await fetch(`/api/admin/workflow-mappings/${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to delete mapping");
      return;
    }
    setNotice(
      json.softDisabled
        ? json.message
        : "Mapping deleted."
    );
    await load();
  }

  async function runPreview() {
    setPreview(null);
    const res = await fetch("/api/admin/workflow-mappings/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobRole, employmentType, placementType }),
    });
    const json = await res.json();
    if (!res.ok) {
      setPreview(json.error ?? "Preview failed");
      return;
    }
    if (!json.match?.workflowTemplateId) {
      setPreview("No workflow would be assigned. Publishing a job with these attributes would be blocked.");
      return;
    }
    const flow = flows.find((f) => f.id === json.match.workflowTemplateId);
    const publishedOk = flow?.status === "published";
    setPreview(
      `Would assign "${json.workflowName ?? json.match.workflowTemplateId}" via ${json.match.matchLevel} (priority ${json.match.priority}).` +
        (publishedOk
          ? " Publishing would be allowed."
          : " Warning: assigned workflow is not published.")
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Workflow configuration</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Configure mapping rules and tenant defaults before publishing job requisitions.
          </p>
        </div>
        <Link href="/admin_recruiter/jobs" className="text-sm text-[#0f514e] hover:underline">
          Job requisitions
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {loading ? <p className="text-sm text-[#64748B]">Loading…</p> : null}

      <section className="mb-6 rounded-lg border border-[#E2E8F0] p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Matching priority</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#64748B]">
          {(priorityGuide.length
            ? priorityGuide
            : [
                "Exact role + employment + placement",
                "Role + employment",
                "Role only",
                "Tenant default",
              ]
          ).map((line) => (
            <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
          ))}
        </ol>
      </section>

      <section className="mb-6 rounded-lg border border-[#E2E8F0] p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Tenant default workflow</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            Default workflow
            <select
              className="mt-1 block min-w-[240px] rounded border px-3 py-2"
              value={defaultWorkflowId}
              onChange={(e) => setDefaultWorkflowId(e.target.value)}
            >
              <option value="">None</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name} ({flow.status})
                  {flow.is_master_template ? " · master" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void saveDefault()}
            className="rounded bg-[#0c918a] px-3 py-2 text-sm text-white"
          >
            Save default
          </button>
        </div>
        {!flows.length ? (
          <p className="mt-3 text-sm text-amber-700">
            No workflows yet.{" "}
            <Link href="/admin_recruiter/dashboard/onboarding-flows" className="underline">
              Create or publish a workflow
            </Link>{" "}
            first.
          </p>
        ) : null}
      </section>

      <section className="mb-8 rounded-lg border border-[#E2E8F0] p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Add mapping rule</h2>
        <form onSubmit={saveMapping} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Job role
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g. RN"
            />
          </label>
          <label className="text-sm">
            Workflow template
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={workflowTemplateId}
              onChange={(e) => setWorkflowTemplateId(e.target.value)}
              required
            >
              <option value="">Select workflow</option>
              {flows
                .filter((f) => f.is_active !== false)
                .map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name} ({flow.status})
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Employment type
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="">Any</option>
              <option value="W2">W2</option>
              <option value="1099">1099</option>
              <option value="Contract">Contract</option>
            </select>
          </label>
          <label className="text-sm">
            Placement type
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={placementType}
              onChange={(e) => setPlacementType(e.target.value)}
            >
              <option value="">Any</option>
              <option value="Internal">Internal</option>
              <option value="Recruit_and_Release">Recruit and Release</option>
              <option value="Recruit_and_EOR">Recruit and EOR</option>
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => void runPreview()}
              className="rounded border px-3 py-2 text-sm"
            >
              Preview assignment
            </button>
            <button type="submit" className="rounded bg-[#0c918a] px-3 py-2 text-sm text-white">
              Save mapping
            </button>
          </div>
        </form>
        {preview ? <p className="mt-3 text-sm text-[#334155]">{preview}</p> : null}
      </section>

      <section className="rounded-lg border border-[#E2E8F0] p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Mappings</h2>
        <ul className="mt-4 divide-y text-sm">
          {mappings.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <span className="font-medium">{row.job_role ?? "Any role"}</span>
                <span className="text-[#64748B]">
                  {" "}
                  · {row.employment_type ?? "any employment"} ·{" "}
                  {row.placement_type ?? "any placement"}
                </span>
                <p className="text-xs text-[#64748B]">
                  {row.workflow_name ?? row.workflow_template_id}
                  {row.workflow_status ? ` (${row.workflow_status})` : ""} · priority{" "}
                  {row.priority} · {row.is_active ? "active" : "disabled"} · used by{" "}
                  {row.jobs_using_workflow} job{row.jobs_using_workflow === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => void toggleActive(row)}
                >
                  {row.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs text-red-700"
                  onClick={() => void removeMapping(row)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {!mappings.length ? (
            <li className="py-3 text-[#64748B]">No mapping rules yet.</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
