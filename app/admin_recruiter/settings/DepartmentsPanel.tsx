"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { DepartmentRecord, DepartmentTarget } from "@/lib/departments/types";

type AssignmentKind = "job" | "candidate";

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

function SettingsSectionIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[30px]">
      <h1 className="text-sm font-semibold leading-5 text-black">{title}</h1>
      <p className="text-[10px] leading-[15px] text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

export default function DepartmentsPanel() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [jobs, setJobs] = useState<DepartmentTarget[]>([]);
  const [candidates, setCandidates] = useState<DepartmentTarget[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [jobResults, setJobResults] = useState<DepartmentTarget[]>([]);
  const [candidateResults, setCandidateResults] = useState<DepartmentTarget[]>([]);
  const openedDepartmentId = useRef<string | null | undefined>(undefined);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/departments", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load departments");
      setDepartments((payload.departments ?? []) as DepartmentRecord[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async (departmentId: string) => {
    setAssignmentsLoading(true);
    try {
      const response = await fetch(`/api/admin/departments/${departmentId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load assignments");
      setJobs((payload.jobs ?? []) as DepartmentTarget[]);
      setCandidates((payload.candidates ?? []) as DepartmentTarget[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load assignments");
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (openedDepartmentId.current === selectedId) return;
    openedDepartmentId.current = selectedId;
    if (!selectedId) return;
    const selected = departments.find((department) => department.id === selectedId);
    setRename(selected?.name ?? "");
    setJobQuery("");
    setCandidateQuery("");
    void loadAssignments(selectedId);
  }, [selectedId, departments, loadAssignments]);

  useEffect(() => {
    if (!selectedId || jobQuery.trim().length < 2) {
      setJobResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchTargets("job", jobQuery).then(setJobResults);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [jobQuery, selectedId]);

  useEffect(() => {
    if (!selectedId || candidateQuery.trim().length < 2) {
      setCandidateResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchTargets("candidate", candidateQuery).then(setCandidateResults);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [candidateQuery, selectedId]);

  async function searchTargets(kind: AssignmentKind, query: string): Promise<DepartmentTarget[]> {
    try {
      const params = new URLSearchParams({ kind, q: query.trim() });
      const response = await fetch(`/api/admin/departments/search?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Search failed");
      return (payload.results ?? []) as DepartmentTarget[];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
      return [];
    }
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const response = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not add department");
      setName("");
      const created = payload.department as DepartmentRecord;
      setDepartments((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedId(created.id);
      toast.success("Department added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add department");
    } finally {
      setCreating(false);
    }
  }

  async function saveName() {
    if (!selectedId) return;
    const trimmed = rename.trim();
    if (!trimmed) return;
    try {
      const response = await fetch(`/api/admin/departments/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not rename department");
      setDepartments((current) =>
        current
          .map((department) =>
            department.id === selectedId ? { ...department, name: trimmed } : department
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success("Department renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename department");
    }
  }

  async function removeDepartment(department: DepartmentRecord) {
    if (department.jobCount > 0 || department.candidateCount > 0) {
      toast.error("Remove this department from its jobs and candidates before deleting it.");
      return;
    }
    try {
      const response = await fetch(`/api/admin/departments/${department.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not delete department");
      setDepartments((current) => current.filter((item) => item.id !== department.id));
      if (selectedId === department.id) setSelectedId(null);
      toast.success("Department deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete department");
    }
  }

  async function toggleAssignment(kind: AssignmentKind, target: DepartmentTarget, assigned: boolean) {
    if (!selectedId) return;
    try {
      const response = await fetch(`/api/admin/departments/${selectedId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, targetId: target.id, assigned }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update assignment");
      await Promise.all([loadDepartments(), loadAssignments(selectedId)]);
      if (kind === "job") setJobQuery("");
      else setCandidateQuery("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update assignment");
    }
  }

  const selected = departments.find((department) => department.id === selectedId) ?? null;

  return (
    <section>
      <SettingsSectionIntro
        title="Departments"
        subtitle="Organize people and work by department. Map a department to a job, or assign it directly to a candidate."
      />

      <form
        className="mb-5 flex max-w-[634px] gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          className={inputClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New department name"
          aria-label="New department name"
          maxLength={80}
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="h-9 shrink-0 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {loading ? (
        <div className="h-28 max-w-[634px] rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      ) : departments.length === 0 ? (
        <div className="max-w-[634px] rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
          No departments yet. Add one, then map it to a job or to candidates.
        </div>
      ) : (
        <div className="grid max-w-[980px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2">
            {departments.map((department) => {
              const active = department.id === selectedId;
              return (
                <li key={department.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(department.id)}
                    className={`w-full rounded-xl border bg-white px-3.5 py-3 text-left ${
                      active ? "border-[#012352]" : "border-[#E5E7EB]"
                    }`}
                  >
                    <p className="text-xs font-semibold leading-4 text-black">{department.name}</p>
                    <p className="mt-0.5 text-[10px] leading-[15px] text-[#6B7280]">
                      {department.jobCount} {department.jobCount === 1 ? "job" : "jobs"} ·{" "}
                      {department.candidateCount}{" "}
                      {department.candidateCount === 1 ? "candidate" : "candidates"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[220px] flex-1 text-[10px] font-medium text-[#6B7280]">
                  Name
                  <input
                    className={`${inputClassName} mt-1`}
                    value={rename}
                    onChange={(event) => setRename(event.target.value)}
                    aria-label="Department name"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={!rename.trim() || rename.trim() === selected.name}
                  className="h-9 rounded-lg border border-[#012352] px-3 text-sm font-medium text-[#012352] disabled:opacity-50"
                >
                  Save name
                </button>
                <button
                  type="button"
                  onClick={() => void removeDepartment(selected)}
                  className="h-9 rounded-lg px-3 text-sm font-medium text-[#B91C1C]"
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 text-[10px] leading-[15px] text-[#6B7280]">
                Candidates on a mapped job use that job&apos;s department. A candidate mapped here
                keeps this department even when their job is different.
              </p>

              {assignmentsLoading ? (
                <div className="mt-4 h-24 rounded-lg bg-[#F3F4F6] motion-safe:animate-pulse" />
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <AssignmentColumn
                    title="By job"
                    empty="No jobs mapped yet."
                    searchLabel="Search jobs"
                    query={jobQuery}
                    onQueryChange={setJobQuery}
                    assigned={jobs}
                    results={jobResults}
                    onAssign={(target) => void toggleAssignment("job", target, true)}
                    onRemove={(target) => void toggleAssignment("job", target, false)}
                  />
                  <AssignmentColumn
                    title="By candidate"
                    empty="No candidates mapped directly."
                    searchLabel="Search candidates"
                    query={candidateQuery}
                    onQueryChange={setCandidateQuery}
                    assigned={candidates}
                    results={candidateResults}
                    onAssign={(target) => void toggleAssignment("candidate", target, true)}
                    onRemove={(target) => void toggleAssignment("candidate", target, false)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
              Select a department to map jobs and candidates.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AssignmentColumn({
  title,
  empty,
  searchLabel,
  query,
  onQueryChange,
  assigned,
  results,
  onAssign,
  onRemove,
}: {
  title: string;
  empty: string;
  searchLabel: string;
  query: string;
  onQueryChange: (value: string) => void;
  assigned: DepartmentTarget[];
  results: DepartmentTarget[];
  onAssign: (target: DepartmentTarget) => void;
  onRemove: (target: DepartmentTarget) => void;
}) {
  const assignedIds = new Set(assigned.map((item) => item.id));
  const suggestions = results.filter((item) => !assignedIds.has(item.id));

  return (
    <div>
      <h2 className="text-xs font-semibold text-black">{title}</h2>
      <input
        className={`${inputClassName} mt-2`}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={`${searchLabel} (2+ letters)`}
        aria-label={searchLabel}
      />
      {query.trim().length >= 2 ? (
        <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-[#E5E7EB]">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[#6B7280]">No matches.</li>
          ) : (
            suggestions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#F3F4F6] px-3 py-2 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-[#111827]">{item.label}</span>
                  {item.departmentName ? (
                    <span className="block truncate text-[10px] text-[#6B7280]">
                      Currently {item.departmentName}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => onAssign(item)}
                  className="shrink-0 text-xs font-medium text-[#012352]"
                >
                  Map
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <ul className="mt-3 flex flex-col gap-1">
        {assigned.length === 0 ? (
          <li className="text-xs text-[#6B7280]">{empty}</li>
        ) : (
          assigned.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="min-w-0 truncate text-xs text-[#111827]">{item.label}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="shrink-0 text-xs font-medium text-[#B91C1C]"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
