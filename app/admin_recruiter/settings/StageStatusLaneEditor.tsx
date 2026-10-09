"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import {
  STAGE_STATUS_LANES,
  type StageStatusLane,
} from "@/lib/jobs/application-statuses/stage-status-lanes";

type LaneStatus = { id: string; name: string; groupName?: string | null };

const LANE_COPY: Record<StageStatusLane, { title: string; detail: string }> = {
  happy_path: {
    title: "Recommended",
    detail: "One button on the stage. It shows the next status in this order, then the one after it.",
  },
  alternate: {
    title: "Exception",
    detail: "Dropdown on the stage. These are the other choices, in this order.",
  },
  closed: {
    title: "Closed / stop",
    detail: "Dropdown on the stage. Stop statuses such as MSP rejections, client rejections, and withdrawals.",
  },
};

export function StageStatusLaneEditor({
  lanes,
  canManage,
  saving,
  onChange,
}: {
  lanes: Record<StageStatusLane, LaneStatus[]>;
  canManage: boolean;
  saving: boolean;
  onChange: (next: Record<StageStatusLane, string[]>) => void;
}) {
  const ids = {
    happy_path: lanes.happy_path.map((status) => status.id),
    alternate: lanes.alternate.map((status) => status.id),
    closed: lanes.closed.map((status) => status.id),
  };

  function commit(next: Record<StageStatusLane, string[]>) {
    onChange(next);
  }

  function move(lane: StageStatusLane, index: number, delta: number) {
    const nextIndex = index + delta;
    const copy = [...ids[lane]];
    if (nextIndex < 0 || nextIndex >= copy.length) return;
    const [statusId] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, statusId);
    commit({ ...ids, [lane]: copy });
  }

  function changeLane(statusId: string, from: StageStatusLane, to: StageStatusLane) {
    if (from === to) return;
    commit({
      ...ids,
      [from]: ids[from].filter((id) => id !== statusId),
      [to]: [...ids[to], statusId],
    });
  }

  return (
    <div className="space-y-3">
      {STAGE_STATUS_LANES.map((lane) => (
        <div key={lane} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#012352]">
            {LANE_COPY[lane].title}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#64748B]">{LANE_COPY[lane].detail}</p>
          {lanes[lane].length === 0 ? (
            <p className="mt-2 text-xs text-[#94A3B8]">None in this order.</p>
          ) : (
            <ol className="mt-2 space-y-1">
              {lanes[lane].map((status, index) => (
                <li
                  key={status.id}
                  className="flex flex-col gap-2 rounded-md bg-white px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 text-sm text-[#0F172A]">
                    <span className="mr-2 text-xs text-[#94A3B8]">{index + 1}.</span>
                    {status.name}
                    {status.groupName ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                        {status.groupName}
                      </span>
                    ) : null}
                  </span>
                  {canManage ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${status.name} up`}
                        disabled={saving || index === 0}
                        onClick={() => move(lane, index, -1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E2E8F0] bg-white text-[#334155] disabled:opacity-40"
                      >
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${status.name} down`}
                        disabled={saving || index === lanes[lane].length - 1}
                        onClick={() => move(lane, index, 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E2E8F0] bg-white text-[#334155] disabled:opacity-40"
                      >
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <label className="sr-only" htmlFor={`${lane}-${status.id}-lane`}>
                        Move {status.name} to another order
                      </label>
                      <select
                        id={`${lane}-${status.id}-lane`}
                        value={lane}
                        disabled={saving}
                        onChange={(event) =>
                          changeLane(status.id, lane, event.target.value as StageStatusLane)
                        }
                        className="h-7 rounded border border-[#E2E8F0] bg-white px-1 text-xs text-[#334155]"
                      >
                        <option value="happy_path">Recommended</option>
                        <option value="alternate">Exception</option>
                        <option value="closed">Closed / stop</option>
                      </select>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
