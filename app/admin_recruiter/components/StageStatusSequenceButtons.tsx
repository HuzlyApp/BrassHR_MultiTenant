"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import {
  resolveStageStatusLanes,
  sequenceOrderedStatuses,
  type StageStatusLane,
} from "@/lib/jobs/application-statuses/stage-status-lanes";
import {
  mapApplicationStatusOptions,
  resolveApplicationStatusFromPayload,
  type StatusOption,
} from "./CandidateApplicationStatusControl";

type StageStatusSequenceButtonsProps = {
  applicationId: string;
  stageName: string;
  onStatusChanged?: (next: { statusName: string; statusId: string }) => void;
  /** Return true when the caller handled a closed status itself. */
  onException?: (status: StatusOption, note: string) => Promise<boolean>;
};

export function StageStatusSequenceButtons({
  applicationId,
  stageName,
  onStatusChanged,
  onException,
}: StageStatusSequenceButtonsProps) {
  const [options, setOptions] = useState<StatusOption[]>([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[] | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const stageFilter = stageName.trim();

  const load = useCallback(async () => {
    const scopedApplicationId = applicationId.trim();
    if (!scopedApplicationId || !stageFilter) return;
    setLoading(true);
    try {
      const [statusRes, assignRes, appRes] = await Promise.all([
        fetch("/api/admin/application-statuses?activeOnly=1", { cache: "no-store" }),
        fetch("/api/admin/application-status-stage-assignments", { cache: "no-store" }),
        fetch(`/api/admin/job-applications/${encodeURIComponent(scopedApplicationId)}`, {
          cache: "no-store",
        }),
      ]);
      const statusPayload = await statusRes.json();
      const assignPayload = await assignRes.json();
      const appPayload = await appRes.json();
      if (!statusRes.ok) throw new Error(statusPayload.error || "Failed to load statuses");
      if (!assignRes.ok) throw new Error(assignPayload.error || "Failed to load stage statuses");
      if (!appRes.ok) throw new Error(appPayload.error || "Failed to load application");

      const nextOptions = mapApplicationStatusOptions(statusPayload);
      const application =
        appPayload.application && typeof appPayload.application === "object"
          ? (appPayload.application as { status?: unknown; status_id?: unknown })
          : {};
      const resolved = resolveApplicationStatusFromPayload(application, nextOptions);
      const rows = Array.isArray(assignPayload.assignments) ? assignPayload.assignments : [];
      setOptions(nextOptions);
      setStatusId(resolved.statusId);
      setAssignedGroupIds(
        rows
          .filter(
            (row: { stageName?: unknown; groupId?: unknown }) =>
              row.stageName === stageFilter && typeof row.groupId === "string" && row.groupId
          )
          .map((row: { groupId: string }) => row.groupId)
      );
    } catch (error) {
      console.error(error);
      setOptions([]);
      setAssignedGroupIds([]);
    } finally {
      setLoading(false);
    }
  }, [applicationId, stageFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const lanes = useMemo(
    () => resolveStageStatusLanes(options, assignedGroupIds ?? []),
    [assignedGroupIds, options]
  );
  const nextHappyPath = useMemo(
    () => sequenceOrderedStatuses(lanes.happy_path, statusId).next,
    [lanes.happy_path, statusId]
  );
  const alternates = lanes.alternate.filter((status) => status.id !== statusId);
  const closed = lanes.closed.filter((status) => status.id !== statusId);

  async function progressTo(option: StatusOption, lane: StageStatusLane) {
    if (!applicationId.trim() || option.id === statusId) return;
    setBusyId(option.id);
    try {
      if (lane === "closed" && onException) {
        const handled = await onException(option, "");
        if (handled) {
          setStatusId(option.id);
          onStatusChanged?.({ statusName: option.name, statusId: option.id });
          return;
        }
      }
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusId: option.id,
            stageName: stageFilter,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");
      const nextName = String(payload.application?.statusName ?? option.name);
      const nextId = String(payload.application?.statusId ?? option.id);
      setStatusId(nextId);
      toast.success(payload.unchanged ? "Status unchanged" : `Status updated to ${nextName}`);
      onStatusChanged?.({ statusName: nextName, statusId: nextId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setBusyId(null);
    }
  }

  if (!stageFilter) return null;
  if (loading || assignedGroupIds == null) {
    return <p className="text-sm text-[#98A2B3]">Loading statuses…</p>;
  }
  if (!nextHappyPath && alternates.length === 0 && closed.length === 0) {
    return (
      <p className="text-sm text-[#98A2B3]">
        No statuses assigned to this step yet. Add a status group in Settings.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Stage status actions">
      <button
        type="button"
        disabled={!nextHappyPath || Boolean(busyId)}
        onClick={() => {
          if (nextHappyPath) void progressTo(nextHappyPath, "happy_path");
        }}
        className="inline-flex h-9 items-center rounded-full bg-[#0F2744] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-default disabled:opacity-60"
      >
        {busyId && nextHappyPath && busyId === nextHappyPath.id
          ? "Updating…"
          : (nextHappyPath?.name ?? "Recommended complete")}
      </button>
      <CategoryMenu
        label="Exception"
        items={alternates}
        busy={Boolean(busyId)}
        busyId={busyId}
        onPick={(option) => void progressTo(option, "alternate")}
      />
      <CategoryMenu
        label="Closed / stop"
        items={closed}
        busy={Boolean(busyId)}
        busyId={busyId}
        tone="stop"
        onPick={(option) => void progressTo(option, "closed")}
      />
    </div>
  );
}

function CategoryMenu({
  label,
  items,
  busy,
  busyId,
  tone,
  onPick,
}: {
  label: string;
  items: StatusOption[];
  busy: boolean;
  busyId: string | null;
  tone?: "stop";
  onPick: (option: StatusOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const empty = items.length === 0;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={empty || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={
          tone === "stop"
            ? "inline-flex h-9 items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-4 text-sm font-semibold text-[#B42318] transition hover:bg-[#FEF2F2] disabled:opacity-60"
            : "inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F8FAFC] disabled:opacity-60"
        }
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute left-0 z-30 mt-1 max-h-64 min-w-[220px] overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          {items.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onPick(option);
                }}
                className="flex w-full px-3 py-2 text-left text-sm text-[#344054] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                {busyId === option.id ? "Updating…" : option.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
