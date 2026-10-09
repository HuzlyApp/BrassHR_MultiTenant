"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Plus, Pencil, Layers3, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  APPLICATION_STATUS_GROUP_KEYS,
  formatGroupStatusSummary,
  groupStatuses,
  isSharedClosedGroupKey,
} from "@/lib/jobs/application-statuses/groups";
import { AI_MATCH_STATUS_STAGES } from "@/lib/jobs/application-statuses/stage-assignments";
import {
  normalizeStageStatusLane,
  resolveStageStatusLanes,
  type SavedStageStatusLane,
  type StageStatusLane,
} from "@/lib/jobs/application-statuses/stage-status-lanes";
import { StageStatusLaneEditor } from "./StageStatusLaneEditor";
import { HIRE_STAGE_BY_STEP_KEY } from "@/lib/onboarding/hire-stage-catalog";
import { PRE_HIRE_FIGMA_STAGES } from "@/lib/onboarding/hire-stage-groups";

type StatusGroup = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  systemKey: string | null;
};

type StatusItem = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  systemKey: string | null;
  groupId: string | null;
  groupName: string | null;
  groupDescription: string | null;
  groupSortOrder: number | null;
  groupSystemKey: string | null;
  buttonLane: string | null;
};

type GroupStageAssignment = {
  id: string;
  stageName: string;
  groupId: string;
  sortOrder: number;
};

type SavedLane = SavedStageStatusLane & { stageName: string };

const PIPELINE_GROUP_KEYS = new Set<string>(APPLICATION_STATUS_GROUP_KEYS);
const fieldClass = "h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm";

function statusesForGroup(statuses: StatusItem[], groupId: string): StatusItem[] {
  return statuses
    .filter((status) => status.groupId === groupId)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
}

function mapStatus(row: Record<string, unknown>): StatusItem {
  return {
    id: String(row.id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
    isActive: Boolean(row.isActive),
    isDefault: Boolean(row.isDefault),
    systemKey: (row.systemKey as string | null) ?? null,
    groupId: typeof row.groupId === "string" ? row.groupId : null,
    groupName: typeof row.groupName === "string" ? row.groupName : null,
    groupDescription: typeof row.groupDescription === "string" ? row.groupDescription : null,
    groupSortOrder: Number.isFinite(Number(row.groupSortOrder)) ? Number(row.groupSortOrder) : null,
    groupSystemKey: typeof row.groupSystemKey === "string" ? row.groupSystemKey : null,
    buttonLane: typeof row.buttonLane === "string" ? row.buttonLane : null,
  };
}

function mapGroup(row: Record<string, unknown>): StatusGroup {
  return {
    id: String(row.id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    sortOrder: Number(row.sortOrder ?? 0),
    systemKey: (row.systemKey as string | null) ?? null,
  };
}

function mapAssignment(row: Record<string, unknown>): GroupStageAssignment {
  return {
    id: String(row.id),
    stageName: String(row.stageName),
    groupId: String(row.groupId),
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

function mapSavedLane(row: Record<string, unknown>): SavedLane | null {
  const lane = normalizeStageStatusLane(typeof row.lane === "string" ? row.lane : "");
  if (!lane) return null;
  const stageName = typeof row.stageName === "string" ? row.stageName : "";
  const statusId = typeof row.statusId === "string" ? row.statusId : "";
  if (!stageName || !statusId) return null;
  return {
    stageName,
    statusId,
    lane,
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

function preHireStepsByStage(): Array<{ stage: string; steps: string[] }> {
  const buckets = new Map<string, string[]>();
  for (const stage of PRE_HIRE_FIGMA_STAGES) {
    buckets.set(stage, []);
  }
  for (const [stepKey, stageName] of Object.entries(HIRE_STAGE_BY_STEP_KEY)) {
    if (!buckets.has(stageName)) continue;
    buckets.get(stageName)!.push(stepKey);
  }
  return PRE_HIRE_FIGMA_STAGES.map((stage) => ({
    stage,
    steps: (buckets.get(stage) ?? []).sort(),
  }));
}

function GroupStatusManager({
  groupId,
  groupName,
  statuses,
  groups,
  saving,
  onAdd,
  onSave,
  onDelete,
  onMove,
}: {
  groupId: string;
  groupName: string;
  statuses: StatusItem[];
  groups: StatusGroup[];
  saving: boolean;
  onAdd: (groupId: string, name: string, description: string) => Promise<boolean>;
  onSave: (statusId: string, name: string, description: string) => Promise<boolean>;
  onDelete: (status: StatusItem) => Promise<void>;
  onMove: (statusId: string, groupId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {statuses.length === 0 ? (
          <li className="text-xs text-[#94A3B8]">No statuses in this group yet.</li>
        ) : (
          statuses.map((status) => (
            <li
              key={status.id}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            >
              {editingId === status.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className={fieldClass}
                    placeholder="Status name"
                    aria-label={`Name for ${status.name}`}
                  />
                  <input
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className={fieldClass}
                    placeholder="Description (optional)"
                    aria-label={`Description for ${status.name}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void onSave(status.id, editName, editDescription).then((saved) => {
                          if (saved) setEditingId(null);
                        });
                      }}
                      className="rounded-lg bg-[#012352] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#334155]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {status.name}
                      {!status.isActive ? (
                        <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    {status.description ? (
                      <p className="mt-0.5 text-xs text-[#64748B]">{status.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <label className="sr-only" htmlFor={`move-${groupId}-${status.id}`}>
                      Move {status.name} to another group
                    </label>
                    <select
                      id={`move-${groupId}-${status.id}`}
                      value={status.groupId ?? ""}
                      disabled={saving}
                      onChange={(event) => void onMove(status.id, event.target.value)}
                      className="h-8 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#334155]"
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditingId(status.id);
                        setEditName(status.name);
                        setEditDescription(status.description ?? "");
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#334155]"
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving || status.isDefault}
                      onClick={() => {
                        const confirmed = window.confirm(`Delete "${status.name}" from ${groupName}?`);
                        if (!confirmed) return;
                        void onDelete(status);
                      }}
                      className="rounded-md border border-[#FECACA] bg-white px-2 py-1 text-xs text-[#991B1B] disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="space-y-2 rounded-lg border border-dashed border-[#CBD5E1] bg-white p-3">
        <p className="text-sm font-semibold text-[#0F172A]">Add status to {groupName}</p>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
          placeholder="Name"
          aria-label={`New status name for ${groupName}`}
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={fieldClass}
          placeholder="Description (optional)"
          aria-label={`New status description for ${groupName}`}
        />
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => {
            void onAdd(groupId, name, description).then((saved) => {
              if (!saved) return;
              setName("");
              setDescription("");
            });
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add status
        </button>
      </div>
    </div>
  );
}

function StageAssignmentCard({
  stage,
  detail,
  stageGroups,
  open,
  available,
  canManage,
  saving,
  assignValue,
  closedSummary,
  onToggle,
  onKeyDown,
  onAssignValue,
  onAssign,
  onRemove,
  statusSummary,
  laneEditor,
}: {
  stage: string;
  detail: string;
  stageGroups: StatusGroup[];
  open: boolean;
  available: StatusGroup[];
  canManage: boolean;
  saving: boolean;
  assignValue: string;
  closedSummary: string;
  onToggle: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onAssignValue: (value: string) => void;
  onAssign: () => void;
  onRemove: (groupId: string) => void;
  statusSummary: (groupId: string, limit?: number) => string;
  laneEditor?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#012352]"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#012352]">{stage}</span>
          <span className="mt-0.5 block text-xs text-[#64748B]">
            {stageGroups.length > 0
              ? stageGroups.map((group) => group.name).join(", ")
              : "No groups assigned yet"}
            {" · "}+ Closed shared
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-[#64748B]">
          {stageGroups.length}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[#E2E8F0] bg-white px-4 py-3">
          {laneEditor}
          <p className="text-[11px] leading-5 text-[#94A3B8]">{detail}</p>

          {stageGroups.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">
              No status groups on this stage yet. Closed still applies here.
            </p>
          ) : (
            <ul className="space-y-2">
              {stageGroups.map((group) => (
                <li
                  key={`${stage}-${group.id}`}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{group.name}</p>
                      <p className="mt-0.5 text-xs text-[#64748B]">{statusSummary(group.id)}</p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRemove(group.id)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#334155] disabled:opacity-50"
                      >
                        <X className="h-3 w-3" aria-hidden />
                        Remove group
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-dashed border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#92400E]">
              Also on this stage — Closed (shared)
            </p>
            <p className="mt-1 text-xs text-[#A16207]">{closedSummary}</p>
          </div>

          {canManage ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor={`assign-group-${stage}`}>
                Assign status group to {stage}
              </label>
              <select
                id={`assign-group-${stage}`}
                value={assignValue}
                disabled={saving || available.length === 0}
                onChange={(event) => onAssignValue(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm sm:flex-1"
              >
                <option value="">
                  {available.length === 0
                    ? "All assignable groups already on this stage"
                    : "Select a status group…"}
                </option>
                {available.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.description ? ` — ${statusSummary(group.id, 3)}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving || !assignValue}
                onClick={onAssign}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#012352] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Assign group
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">
              Only administrators can assign status groups to stages.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CatalogSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[#012352]">
          <Layers3 className="h-4 w-4 shrink-0" aria-hidden />
          {title}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748B] transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? <div className="space-y-2 border-t border-[#E2E8F0] px-4 py-3">{children}</div> : null}
    </div>
  );
}

export default function CandidateStatusesPanel() {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [assignments, setAssignments] = useState<GroupStageAssignment[]>([]);
  const [savedLanes, setSavedLanes] = useState<SavedLane[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [assignPicker, setAssignPicker] = useState<Record<string, string>>({});
  const [managingGroupIds, setManagingGroupIds] = useState<Set<string>>(() => new Set());
  const [openCatalogs, setOpenCatalogs] = useState<Set<string>>(() => new Set());
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => new Set());
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [draftGroupName, setDraftGroupName] = useState("");
  const [draftGroupNotes, setDraftGroupNotes] = useState("");
  const [draftGroupStatuses, setDraftGroupStatuses] = useState<Array<{ name: string; note: string }>>([
    { name: "", note: "" },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [statusRes, assignRes] = await Promise.all([
        fetch("/api/admin/application-statuses"),
        fetch("/api/admin/application-status-stage-assignments"),
      ]);
      const statusPayload = await statusRes.json().catch(() => ({}));
      const assignPayload = await assignRes.json().catch(() => ({}));
      if (!statusRes.ok) throw new Error(statusPayload.error || "Failed to load statuses");
      if (!assignRes.ok) throw new Error(assignPayload.error || "Failed to load stage assignments");

      const nextGroups = ((statusPayload.groups ?? []) as Array<Record<string, unknown>>)
        .map(mapGroup)
        .filter((group) => !group.systemKey || PIPELINE_GROUP_KEYS.has(group.systemKey));
      setGroups(nextGroups);
      setStatuses(((statusPayload.statuses ?? []) as Array<Record<string, unknown>>).map(mapStatus));
      setAssignments(
        ((assignPayload.assignments ?? []) as Array<Record<string, unknown>>).map(mapAssignment)
      );
      setSavedLanes(
        ((assignPayload.lanes ?? []) as Array<Record<string, unknown>>)
          .map(mapSavedLane)
          .filter((row): row is SavedLane => row != null)
      );
      setCanManage(Boolean(statusPayload.canManage || assignPayload.canManage));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load statuses";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workflowStages = useMemo(() => preHireStepsByStage(), []);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const assignableGroups = useMemo(
    () => groups.filter((group) => !isSharedClosedGroupKey(group.systemKey)),
    [groups]
  );

  const closedGroup = useMemo(
    () => groups.find((group) => isSharedClosedGroupKey(group.systemKey)) ?? null,
    [groups]
  );

  const closedStatuses = useMemo(
    () =>
      statuses.filter(
        (status) =>
          status.isActive &&
          (isSharedClosedGroupKey(status.groupSystemKey) ||
            status.groupId === closedGroup?.id)
      ),
    [statuses, closedGroup]
  );

  const groupsByStage = useMemo(() => {
    const map = new Map<string, StatusGroup[]>();
    for (const stage of [...PRE_HIRE_FIGMA_STAGES, ...AI_MATCH_STATUS_STAGES]) map.set(stage, []);
    for (const row of [...assignments].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const group = groupById.get(row.groupId);
      if (!group || isSharedClosedGroupKey(group.systemKey)) continue;
      map.get(row.stageName)?.push(group);
    }
    return map;
  }, [assignments, groupById]);

  const statusesInGroup = useCallback(
    (groupId: string) =>
      statuses
        .filter((status) => status.groupId === groupId && status.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [statuses]
  );

  const sections = useMemo(() => {
    const pipelineGroups = groups.filter(
      (group) => !group.systemKey || PIPELINE_GROUP_KEYS.has(group.systemKey)
    );
    const grouped = groupStatuses(statuses);
    const catalogSections = grouped.filter(
      (section) =>
        section.name === "Ungrouped" ||
        pipelineGroups.some((group) => group.id === section.id) ||
        PIPELINE_GROUP_KEYS.has(section.name.toLowerCase())
    );
    const present = new Set(catalogSections.map((section) => section.id).filter(Boolean));
    const emptyGroups = pipelineGroups
      .filter((group) => !present.has(group.id))
      .map((group) => ({
        key: group.id,
        id: group.id,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        systemKey: group.systemKey,
        shared: isSharedClosedGroupKey(group.systemKey),
        statuses: [] as StatusItem[],
      }));
    return [...catalogSections, ...emptyGroups].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
    );
  }, [groups, statuses]);

  function flash(type: "success" | "error", text: string) {
    setSaveMessage({ type, text });
    if (type === "success") toast.success(text);
    else toast.error(text);
  }

  async function assignGroup(stageName: string, groupId: string) {
    if (!groupId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-status-stage-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", stageName, groupId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to assign group");
      setAssignments(((payload.assignments ?? []) as Array<Record<string, unknown>>).map(mapAssignment));
      setAssignPicker((current) => ({ ...current, [stageName]: "" }));
      flash("success", `Group assigned to ${stageName}`);
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to assign group");
    } finally {
      setSaving(false);
    }
  }

  async function saveStageLanes(stageName: string, lanes: Record<StageStatusLane, string[]>) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-status-stage-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setLanes", stageName, lanes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save status order");
      setSavedLanes(
        ((payload.lanes ?? []) as Array<Record<string, unknown>>)
          .map(mapSavedLane)
          .filter((row): row is SavedLane => row != null)
      );
      flash("success", `Status order saved for ${stageName}`);
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to save status order");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(stageName: string, groupId: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-status-stage-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unassign", stageName, groupId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to remove group");
      setAssignments(((payload.assignments ?? []) as Array<Record<string, unknown>>).map(mapAssignment));
      flash("success", `Group removed from ${stageName}`);
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to remove group");
    } finally {
      setSaving(false);
    }
  }

  function upsertStatus(row: Record<string, unknown>) {
    const next = mapStatus(row);
    setStatuses((current) => {
      const index = current.findIndex((status) => status.id === next.id);
      if (index < 0) return [...current, next];
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  }

  async function addStatus(groupId: string, name: string, description: string): Promise<boolean> {
    if (!name.trim()) {
      flash("error", "Status name is required");
      return false;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          groupId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create status");
      if (payload.status && typeof payload.status === "object") {
        upsertStatus(payload.status as Record<string, unknown>);
      }
      flash("success", "Status created");
      return true;
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to create status");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus(statusId: string, name: string, description: string): Promise<boolean> {
    if (!name.trim()) {
      flash("error", "Status name is required");
      return false;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/application-statuses/${encodeURIComponent(statusId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      if (payload.status && typeof payload.status === "object") {
        upsertStatus(payload.status as Record<string, unknown>);
      }
      flash("success", "Status updated");
      return true;
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to update status");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteStatus(status: StatusItem) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/application-statuses/${encodeURIComponent(status.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Failed to delete status");
      setStatuses((current) => current.filter((row) => row.id !== status.id));
      flash("success", "Status deleted");
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to delete status");
    } finally {
      setSaving(false);
    }
  }

  async function moveToGroup(statusId: string, groupId: string) {
    if (!groupId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/application-statuses/${encodeURIComponent(statusId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to move status");
      if (payload.status && typeof payload.status === "object") {
        upsertStatus(payload.status as Record<string, unknown>);
      }
      flash("success", "Status moved to its group");
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Failed to move status");
    } finally {
      setSaving(false);
    }
  }

  function toggleCatalog(id: string) {
    setOpenCatalogs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroupCard(id: string) {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createGroup() {
    const name = draftGroupName.trim();
    if (!name) {
      flash("error", "Group name is required");
      return;
    }
    const notes = draftGroupStatuses
      .map((row) => ({ name: row.name.trim(), note: row.note.trim() }))
      .filter((row) => row.name);
    let groupCreated = false;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/application-status-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: draftGroupNotes.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create status group");
      const group = mapGroup(payload.group as Record<string, unknown>);
      setGroups((current) => [...current, group].sort((a, b) => a.sortOrder - b.sortOrder));
      groupCreated = true;
      for (const note of notes) {
        const statusResponse = await fetch("/api/admin/application-statuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: note.name,
            description: note.note || null,
            groupId: group.id,
          }),
        });
        const statusPayload = await statusResponse.json();
        if (!statusResponse.ok) {
          throw new Error(statusPayload.error || `Failed to add ${note.name}`);
        }
        if (statusPayload.status && typeof statusPayload.status === "object") {
          upsertStatus(statusPayload.status as Record<string, unknown>);
        }
      }
      setOpenGroupIds((current) => new Set(current).add(group.id));
      setDraftGroupName("");
      setDraftGroupNotes("");
      setDraftGroupStatuses([{ name: "", note: "" }]);
      setAddGroupOpen(false);
      flash("success", notes.length > 0 ? "Status group created with its statuses" : "Status group created");
    } catch (error) {
      flash(
        "error",
        groupCreated
          ? error instanceof Error
            ? `${error.message} The group was still created.`
            : "The group was created, but a status could not be added."
          : error instanceof Error
            ? error.message
            : "Failed to create status group"
      );
      if (!groupCreated) return;
      setDraftGroupName("");
      setDraftGroupNotes("");
      setDraftGroupStatuses([{ name: "", note: "" }]);
      setAddGroupOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function toggleStage(stage: string) {
    setOpenStage((current) => (current === stage ? null : stage));
  }

  function onStageKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, stage: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleStage(stage);
    }
  }

  function stageCard(stage: string, detail: string, withLanes = false) {
    const stageGroups = groupsByStage.get(stage) ?? [];
    const assignedIds = new Set(stageGroups.map((group) => group.id));
    return (
      <StageAssignmentCard
        key={stage}
        stage={stage}
        detail={detail}
        stageGroups={stageGroups}
        open={openStage === stage}
        available={assignableGroups.filter((group) => !assignedIds.has(group.id))}
        canManage={canManage}
        saving={saving}
        assignValue={assignPicker[stage] ?? ""}
        closedSummary={formatGroupStatusSummary(
          closedStatuses.map((status) => status.name),
          8
        )}
        onToggle={() => toggleStage(stage)}
        onKeyDown={(event) => onStageKeyDown(event, stage)}
        onAssignValue={(value) =>
          setAssignPicker((current) => ({
            ...current,
            [stage]: value,
          }))
        }
        onAssign={() => void assignGroup(stage, assignPicker[stage] ?? "")}
        onRemove={(groupId) => void removeGroup(stage, groupId)}
        statusSummary={(groupId, limit) =>
          formatGroupStatusSummary(
            statusesInGroup(groupId).map((status) => status.name),
            limit
          )
        }
        laneEditor={
          withLanes ? (
            <StageStatusLaneEditor
              lanes={resolveStageStatusLanes(
                statuses.filter((status) => status.isActive),
                stageGroups.map((group) => group.id),
                savedLanes.filter((row) => row.stageName === stage)
              )}
              canManage={canManage}
              saving={saving}
              onChange={(next) => void saveStageLanes(stage, next)}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      {saveMessage ? (
        <div
          role="status"
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            saveMessage.type === "success"
              ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
              : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
          }`}
        >
          {saveMessage.text}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#64748B]">Loading status catalog…</p>
      ) : loadError ? (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-3 text-sm text-[#991B1B]">
          <p>Could not load status catalog: {loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-md border border-[#FECACA] bg-white px-3 py-1.5 text-xs font-medium text-[#991B1B]"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <CatalogSection
            title="Status groups"
            open={openCatalogs.has("groups")}
            onToggle={() => toggleCatalog("groups")}
          >
            {canManage ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
                <button
                  type="button"
                  aria-expanded={addGroupOpen}
                  onClick={() => setAddGroupOpen((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#012352]">
                    <Plus className="h-4 w-4" aria-hidden />
                    Add status group
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[#64748B] transition ${addGroupOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {addGroupOpen ? (
                  <div className="space-y-2 border-t border-[#E2E8F0] px-4 py-3">
                    <input
                      value={draftGroupName}
                      onChange={(event) => setDraftGroupName(event.target.value)}
                      className={fieldClass}
                      placeholder="Group name"
                      aria-label="New status group name"
                    />
                    <textarea
                      value={draftGroupNotes}
                      onChange={(event) => setDraftGroupNotes(event.target.value)}
                      className="min-h-20 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm"
                      placeholder="Notes for this group (optional)"
                      aria-label="Notes for the new status group"
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#334155]">Statuses in this group</p>
                      {draftGroupStatuses.map((row, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={row.name}
                            onChange={(event) =>
                              setDraftGroupStatuses((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, name: event.target.value } : item
                                )
                              )
                            }
                            className={fieldClass}
                            placeholder="Status name"
                            aria-label={`Status ${index + 1} name`}
                          />
                          <input
                            value={row.note}
                            onChange={(event) =>
                              setDraftGroupStatuses((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, note: event.target.value } : item
                                )
                              )
                            }
                            className={fieldClass}
                            placeholder="Note (optional)"
                            aria-label={`Status ${index + 1} note`}
                          />
                          <button
                            type="button"
                            disabled={draftGroupStatuses.length === 1}
                            onClick={() =>
                              setDraftGroupStatuses((current) =>
                                current.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                            className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#334155] disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setDraftGroupStatuses((current) => [...current, { name: "", note: "" }])
                        }
                        className="text-xs font-medium text-[#012352]"
                      >
                        Add another status
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={saving || !draftGroupName.trim()}
                      onClick={() => void createGroup()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Create group
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {sections.map((section) => {
              const shared = section.shared || isSharedClosedGroupKey(section.systemKey);
              const stagesUsing = assignments
                .filter((row) => row.groupId === section.id)
                .map((row) => row.stageName);
              const groupStatusesList = section.id ? statusesForGroup(statuses, section.id) : [];
              const activeStatuses = groupStatusesList.filter((status) => status.isActive);
              const managing = Boolean(section.id && managingGroupIds.has(section.id));
              const groupOpen = openGroupIds.has(section.key);
              return (
                <div
                  key={section.key}
                  className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
                >
                  <button
                    type="button"
                    aria-expanded={groupOpen}
                    onClick={() => toggleGroupCard(section.key)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-semibold text-[#012352]">{section.name}</span>
                      <span className="mt-0.5 block text-xs text-[#64748B]">
                        {shared
                          ? "On every Pre-Hire stage and AI analysis step"
                          : stagesUsing.length > 0
                            ? `On stages: ${stagesUsing.join(", ")}`
                            : "Not assigned to any stage yet"}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 text-xs text-[#64748B]">
                      {activeStatuses.length}
                      <ChevronDown
                        className={`h-4 w-4 transition ${groupOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                  </button>
                  {groupOpen ? (
                    <div className="space-y-3 border-t border-[#E2E8F0]/60 px-4 py-3">
                      {canManage && section.id ? (
                        <button
                          type="button"
                          onClick={() =>
                            setManagingGroupIds((current) => {
                              const next = new Set(current);
                              if (!section.id) return next;
                              if (next.has(section.id)) next.delete(section.id);
                              else next.add(section.id);
                              return next;
                            })
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#334155]"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          {managing ? "Done" : "Manage"}
                        </button>
                      ) : null}
                      {managing && section.id ? (
                        <GroupStatusManager
                          groupId={section.id}
                          groupName={section.name}
                          statuses={groupStatusesList}
                          groups={groups}
                          saving={saving}
                          onAdd={addStatus}
                          onSave={saveStatus}
                          onDelete={deleteStatus}
                          onMove={moveToGroup}
                        />
                      ) : activeStatuses.length === 0 ? (
                        <p className="text-xs text-[#94A3B8]">No statuses in this group.</p>
                      ) : (
                        <p className="text-xs leading-5 text-[#475569]">
                          {activeStatuses.map((status) => status.name).join(", ")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CatalogSection>

          <CatalogSection
            title="Pre-Hire workflow status catalog"
            open={openCatalogs.has("prehire")}
            onToggle={() => toggleCatalog("prehire")}
          >
            {workflowStages.map(({ stage, steps }) =>
              stageCard(
                stage,
                `Workflow steps: ${steps.length > 0 ? steps.join(", ") : "None mapped"}`,
                true
              )
            )}
          </CatalogSection>

          <CatalogSection
            title="AI analysis workflow status catalog"
            open={openCatalogs.has("ai")}
            onToggle={() => toggleCatalog("ai")}
          >
            {AI_MATCH_STATUS_STAGES.map((stage) =>
              stageCard(
                stage,
                "Statuses from the groups assigned here, plus Follow up and Closed, can be ordered for this step.",
                true
              )
            )}
          </CatalogSection>
        </div>
      )}
    </section>
  );
}
