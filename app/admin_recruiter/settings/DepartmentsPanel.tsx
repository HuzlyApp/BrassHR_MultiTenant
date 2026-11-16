"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MoreHorizontal, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import type { DepartmentRecord, DepartmentTarget } from "@/lib/departments/types";
import {
  ListPaginationControls,
  ListPaginationShowLabel,
} from "@/app/admin_recruiter/components/ListPaginationControls";
import SettingsSelect from "./SettingsSelect";

type AssignmentKind = "job" | "candidate";
type StatusFilter = "all" | "active" | "inactive";
type PanelMode = "create" | "edit" | "manage" | null;

const PAGE_SIZE_OPTIONS = [6, 10, 25, 50];
const DESCRIPTION_MAX = 100;

const inputClassName =
  "h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none transition focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

const labelClassName = "text-sm font-medium text-[#94A3B8]";

function RequiredMark() {
  return <span className="text-[#EF4444]">*</span>;
}

function memberInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function DepartmentsPanel() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [invitedMemberIds, setInvitedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<DepartmentTarget[]>([]);
  const [candidates, setCandidates] = useState<DepartmentTarget[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [jobResults, setJobResults] = useState<DepartmentTarget[]>([]);
  const [candidateResults, setCandidateResults] = useState<DepartmentTarget[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
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

  const updateMenuPosition = useCallback(() => {
    if (!menuId) {
      setMenuStyle(null);
      return;
    }
    const trigger = menuButtonRefs.current.get(menuId);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 180;
    const estimatedHeight = 180;
    const openUp = window.innerHeight - rect.bottom < estimatedHeight + 8;
    setMenuStyle({
      position: "fixed",
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: "auto" }
        : { top: rect.bottom + 4, bottom: "auto" }),
      visibility: "visible",
      pointerEvents: "auto",
    });
  }, [menuId]);

  useLayoutEffect(() => {
    if (!menuId) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuId, updateMenuPosition]);

  useEffect(() => {
    if (!menuId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      const trigger = menuButtonRefs.current.get(menuId);
      if (trigger?.contains(target)) return;
      setMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId]);

  useEffect(() => {
    if (panelMode !== "manage" || !selectedId) return;
    if (openedDepartmentId.current === selectedId) return;
    openedDepartmentId.current = selectedId;
    setJobQuery("");
    setCandidateQuery("");
    void loadAssignments(selectedId);
  }, [panelMode, selectedId, loadAssignments]);

  useEffect(() => {
    if (panelMode !== "manage" || !selectedId || jobQuery.trim().length < 2) {
      setJobResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchTargets("job", jobQuery).then(setJobResults);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [jobQuery, selectedId, panelMode]);

  useEffect(() => {
    if (panelMode !== "manage" || !selectedId || candidateQuery.trim().length < 2) {
      setCandidateResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchTargets("candidate", candidateQuery).then(setCandidateResults);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [candidateQuery, selectedId, panelMode]);

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return departments.filter((department) => {
      if (statusFilter === "active" && !department.isActive) return false;
      if (statusFilter === "inactive" && department.isActive) return false;
      if (!needle) return true;
      return (
        department.name.toLowerCase().includes(needle) ||
        (department.code ?? "").toLowerCase().includes(needle) ||
        (department.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [departments, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = departments.find((department) => department.id === selectedId) ?? null;

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  function openCreate() {
    setSelectedId(null);
    setDraftCode("");
    setDraftName("");
    setDraftDescription("");
    setDraftActive(true);
    setInvitedMemberIds([]);
    setPanelMode("create");
    setMenuId(null);
  }

  function openEdit(department: DepartmentRecord) {
    setSelectedId(department.id);
    setDraftCode(department.code ?? "");
    setDraftName(department.name);
    setDraftDescription(department.description ?? "");
    setDraftActive(department.isActive);
    setInvitedMemberIds([]);
    setPanelMode("edit");
    setMenuId(null);
  }

  function openManage(department: DepartmentRecord) {
    openedDepartmentId.current = undefined;
    setSelectedId(department.id);
    setPanelMode("manage");
    setMenuId(null);
  }

  function closePanel() {
    setPanelMode(null);
    setSelectedId(null);
    setInvitedMemberIds([]);
    setSaving(false);
  }

  async function createDepartment() {
    const trimmedName = draftName.trim();
    const trimmedCode = draftCode.trim();
    if (!trimmedName || !trimmedCode) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          code: trimmedCode,
          description: draftDescription.trim() || null,
          memberIds: invitedMemberIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not add department");
      const created = payload.department as DepartmentRecord;
      setDepartments((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success("Department added");
      closePanel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add department");
    } finally {
      setSaving(false);
    }
  }

  async function saveDepartment() {
    if (!selectedId) return;
    const trimmedName = draftName.trim();
    const trimmedCode = draftCode.trim();
    if (!trimmedName || !trimmedCode) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/departments/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          code: trimmedCode,
          description: draftDescription.trim() || null,
          isActive: draftActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update department");
      setDepartments((current) =>
        current
          .map((department) =>
            department.id === selectedId
              ? {
                  ...department,
                  name: trimmedName,
                  code: trimmedCode,
                  description: draftDescription.trim() || null,
                  isActive: draftActive,
                }
              : department
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success("Department updated");
      closePanel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update department");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(department: DepartmentRecord) {
    setMenuId(null);
    try {
      const response = await fetch(`/api/admin/departments/${department.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !department.isActive }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update status");
      setDepartments((current) =>
        current.map((row) =>
          row.id === department.id ? { ...row, isActive: !department.isActive } : row
        )
      );
      toast.success(department.isActive ? "Department set to inactive" : "Department activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status");
    }
  }

  async function removeDepartment(department: DepartmentRecord) {
    setMenuId(null);
    if (department.jobCount > 0 || department.candidateCount > 0) {
      toast.error("Remove this department from its jobs and candidates before deleting it.");
      return;
    }
    try {
      const response = await fetch(`/api/admin/departments/${department.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not delete department");
      setDepartments((current) => current.filter((item) => item.id !== department.id));
      if (selectedId === department.id) closePanel();
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

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 tracking-tight text-[#101828]">Departments</h1>
          <p className="mt-1 text-sm leading-5 text-[#6B7280]">Manage your departments</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#012352] px-4 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Add Department
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
            aria-hidden
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search department..."
            aria-label="Search department"
            className={`${inputClassName} pl-9`}
          />
        </label>
        <SettingsSelect
          aria-label="Filter departments"
          value={statusFilter}
          className="w-full sm:w-48"
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { value: "all", label: "All Departments" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EEF2F6] bg-[#F8FAFC]">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Dept No.
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Department
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Description
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Employees
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-[#6B7280]">
                      {departments.length === 0
                        ? "No departments yet. Add one to get started."
                        : "No departments match your search."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((department) => (
                    <tr key={department.id} className="border-b border-[#EEF2F6] last:border-b-0">
                      <td className="px-5 py-4 text-sm tabular-nums text-[#64748B]">
                        {department.code?.trim() || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#0F172A]">
                        {department.name}
                      </td>
                      <td className="max-w-md px-5 py-4 text-sm text-[#64748B]">
                        {department.description?.trim() || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums text-[#64748B]">
                        {department.candidateCount}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            department.isActive
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                        >
                          {department.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          ref={(node) => {
                            if (node) menuButtonRefs.current.set(department.id, node);
                            else menuButtonRefs.current.delete(department.id);
                          }}
                          type="button"
                          aria-label={`Actions for ${department.name}`}
                          aria-haspopup="menu"
                          aria-expanded={menuId === department.id}
                          onClick={() =>
                            setMenuId((current) => (current === department.id ? null : department.id))
                          }
                          className="inline-flex size-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#EEF2F6] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#64748B]">
              {filtered.length === 0
                ? "Showing 0 results"
                : `Showing ${pageStart}-${pageEnd} of ${filtered.length} results`}
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <ListPaginationShowLabel
                pageSize={pageSize}
                options={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(size) => setPageSize(size)}
              />
              <ListPaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                activeStyle={{ backgroundColor: "#012352", borderColor: "#012352" }}
              />
            </div>
          </div>
        </div>
      )}

      {menuId && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="z-[300] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
            >
              {(() => {
                const department = departments.find((row) => row.id === menuId);
                if (!department) return null;
                return (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openEdit(department)}
                      className="flex w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openManage(department)}
                      className="flex w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      Manage mappings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void toggleActive(department)}
                      className="flex w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      {department.isActive ? "Set inactive" : "Activate"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void removeDepartment(department)}
                      className="flex w-full px-3 py-2 text-left text-sm text-[#B91C1C] hover:bg-[#FEF2F2]"
                    >
                      Delete
                    </button>
                  </>
                );
              })()}
            </div>,
            document.body
          )
        : null}

      {panelMode === "create" || panelMode === "edit" ? (
        <DepartmentFormModal
          mode={panelMode}
          code={draftCode}
          name={draftName}
          description={draftDescription}
          isActive={draftActive}
          invitedMemberIds={invitedMemberIds}
          saving={saving}
          onCodeChange={setDraftCode}
          onNameChange={setDraftName}
          onDescriptionChange={setDraftDescription}
          onActiveChange={setDraftActive}
          onInvitedMemberIdsChange={setInvitedMemberIds}
          onClose={closePanel}
          onSave={() => void (panelMode === "create" ? createDepartment() : saveDepartment())}
        />
      ) : null}

      {panelMode === "manage" && selected ? (
        <ManageMappingsModal
          department={selected}
          loading={assignmentsLoading}
          jobs={jobs}
          candidates={candidates}
          jobQuery={jobQuery}
          candidateQuery={candidateQuery}
          jobResults={jobResults}
          candidateResults={candidateResults}
          onJobQueryChange={setJobQuery}
          onCandidateQueryChange={setCandidateQuery}
          onAssignJob={(target) => void toggleAssignment("job", target, true)}
          onRemoveJob={(target) => void toggleAssignment("job", target, false)}
          onAssignCandidate={(target) => void toggleAssignment("candidate", target, true)}
          onRemoveCandidate={(target) => void toggleAssignment("candidate", target, false)}
          onClose={closePanel}
        />
      ) : null}
    </section>
  );
}

function DepartmentFormModal({
  mode,
  code,
  name,
  description,
  isActive,
  invitedMemberIds,
  saving,
  onCodeChange,
  onNameChange,
  onDescriptionChange,
  onActiveChange,
  onInvitedMemberIdsChange,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  invitedMemberIds: string[];
  saving: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
  onInvitedMemberIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const title = mode === "create" ? "Add New Department" : "Edit Department";
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<DepartmentTarget[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const membersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!membersOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!membersRef.current?.contains(event.target as Node)) setMembersOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [membersOpen]);

  useEffect(() => {
    if (!membersOpen || mode !== "create") return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setMembersLoading(true);
      void (async () => {
        try {
          const params = new URLSearchParams({ kind: "candidate", q: memberQuery.trim() });
          const response = await fetch(`/api/admin/departments/search?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Search failed");
          if (!cancelled) setMemberResults((payload.results ?? []) as DepartmentTarget[]);
        } catch (error) {
          if (!cancelled) {
            setMemberResults([]);
            toast.error(error instanceof Error ? error.message : "Search failed");
          }
        } finally {
          if (!cancelled) setMembersLoading(false);
        }
      })();
    }, memberQuery.trim() ? 200 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [membersOpen, memberQuery, mode]);

  function toggleInvite(memberId: string) {
    onInvitedMemberIdsChange(
      invitedMemberIds.includes(memberId)
        ? invitedMemberIds.filter((id) => id !== memberId)
        : [...invitedMemberIds, memberId]
    );
  }

  const canSave = Boolean(code.trim() && name.trim()) && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[min(92dvh,760px)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-2">
          <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          <label className="block space-y-1.5">
            <span className={labelClassName}>
              Dept Number <RequiredMark />
            </span>
            <input
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              maxLength={40}
              disabled={saving}
              placeholder="F-01"
              aria-required
              className={inputClassName}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClassName}>
              Department Name <RequiredMark />
            </span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              maxLength={80}
              disabled={saving}
              placeholder="Finance & Accounting"
              aria-required
              className={inputClassName}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Description (Optional)</span>
            <textarea
              value={description}
              onChange={(event) =>
                onDescriptionChange(event.target.value.slice(0, DESCRIPTION_MAX))
              }
              disabled={saving}
              rows={4}
              maxLength={DESCRIPTION_MAX}
              placeholder="Describe this department…"
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-6 text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]"
            />
            <div className="flex justify-end">
              <span className="text-xs text-[#94A3B8]">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </label>

          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-sm text-[#334155]">
              <input
                type="checkbox"
                checked={isActive}
                disabled={saving}
                onChange={(event) => onActiveChange(event.target.checked)}
                className="size-4 rounded border-[#CBD5E1] text-[#012352]"
              />
              Active
            </label>
          ) : (
            <div ref={membersRef} className="space-y-1.5">
              <p className={labelClassName}>Assign Members to department</p>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={membersOpen}
                disabled={saving}
                onClick={() => setMembersOpen((current) => !current)}
                className={`${inputClassName} flex items-center justify-between text-left`}
              >
                <span className={invitedMemberIds.length ? "text-[#0F172A]" : "text-[#94A3B8]"}>
                  {invitedMemberIds.length
                    ? `${invitedMemberIds.length} member${invitedMemberIds.length === 1 ? "" : "s"} selected`
                    : "Add Member"}
                </span>
                <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden />
              </button>

              {membersOpen ? (
                <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
                  <div className="relative border-b border-[#F1F5F9] p-2">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                      aria-hidden
                    />
                    <input
                      value={memberQuery}
                      onChange={(event) => setMemberQuery(event.target.value)}
                      placeholder="Search by typing the name..."
                      aria-label="Search members"
                      className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#0F172A] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30"
                    />
                  </div>
                  <ul className="max-h-56 overflow-auto py-1">
                    {membersLoading ? (
                      <li className="px-3 py-3 text-sm text-[#94A3B8]">Searching…</li>
                    ) : memberResults.length === 0 ? (
                      <li className="px-3 py-3 text-sm text-[#94A3B8]">No members found</li>
                    ) : (
                      memberResults.map((member) => {
                        const invited = invitedMemberIds.includes(member.id);
                        return (
                          <li
                            key={member.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#F8FAFC]"
                          >
                            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-xs font-semibold text-[#012352]">
                              {memberInitials(member.label)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-[#0F172A]">
                                {member.label}
                              </span>
                              <span className="mt-0.5 inline-flex rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-medium text-[#166534]">
                                Active
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => toggleInvite(member.id)}
                              className={
                                invited
                                  ? "inline-flex h-8 shrink-0 items-center rounded-lg bg-[#012352] px-3 text-xs font-semibold text-white"
                                  : "inline-flex h-8 shrink-0 items-center rounded-lg border border-[#012352] bg-white px-3 text-xs font-semibold text-[#012352]"
                              }
                            >
                              {invited ? "Invite Sent" : "Send Invite"}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-xl border border-[#012352] bg-white px-4 text-sm font-semibold text-[#012352] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="inline-flex h-10 items-center rounded-xl bg-[#012352] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "create" ? "Add Department" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageMappingsModal({
  department,
  loading,
  jobs,
  candidates,
  jobQuery,
  candidateQuery,
  jobResults,
  candidateResults,
  onJobQueryChange,
  onCandidateQueryChange,
  onAssignJob,
  onRemoveJob,
  onAssignCandidate,
  onRemoveCandidate,
  onClose,
}: {
  department: DepartmentRecord;
  loading: boolean;
  jobs: DepartmentTarget[];
  candidates: DepartmentTarget[];
  jobQuery: string;
  candidateQuery: string;
  jobResults: DepartmentTarget[];
  candidateResults: DepartmentTarget[];
  onJobQueryChange: (value: string) => void;
  onCandidateQueryChange: (value: string) => void;
  onAssignJob: (target: DepartmentTarget) => void;
  onRemoveJob: (target: DepartmentTarget) => void;
  onAssignCandidate: (target: DepartmentTarget) => void;
  onRemoveCandidate: (target: DepartmentTarget) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Manage mappings for ${department.name}`}
        className="flex max-h-[min(92dvh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">{department.name}</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Map this department to jobs or assign it directly to candidates.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="h-40 rounded-xl bg-[#F3F4F6] motion-safe:animate-pulse" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AssignmentColumn
                title="By job"
                empty="No jobs mapped yet."
                searchLabel="Search jobs"
                query={jobQuery}
                onQueryChange={onJobQueryChange}
                assigned={jobs}
                results={jobResults}
                onAssign={onAssignJob}
                onRemove={onRemoveJob}
              />
              <AssignmentColumn
                title="By candidate"
                empty="No candidates mapped directly."
                searchLabel="Search candidates"
                query={candidateQuery}
                onQueryChange={onCandidateQueryChange}
                assigned={candidates}
                results={candidateResults}
                onAssign={onAssignCandidate}
                onRemove={onRemoveCandidate}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F172A]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
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
      <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
      <input
        className={`${inputClassName} mt-2`}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={`${searchLabel} (2+ letters)`}
        aria-label={searchLabel}
      />
      {query.trim().length >= 2 ? (
        <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-[#E5E7EB]">
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#6B7280]">No matches.</li>
          ) : (
            suggestions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 border-b border-[#F3F4F6] px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-[#111827]">{item.label}</span>
                  {item.departmentName ? (
                    <span className="block truncate text-xs text-[#6B7280]">
                      Currently {item.departmentName}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => onAssign(item)}
                  className="shrink-0 text-sm font-medium text-[#012352]"
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
          <li className="text-sm text-[#6B7280]">{empty}</li>
        ) : (
          assigned.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-[#111827]">{item.label}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="shrink-0 text-sm font-medium text-[#B91C1C]"
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
