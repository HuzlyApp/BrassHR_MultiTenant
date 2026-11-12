"use client";

import { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import {
  ListPaginationControls,
  ListPaginationShowLabel,
} from "@/app/admin_recruiter/components/ListPaginationControls";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

type TaskStatus = "pending" | "in_progress" | "completed";

type WorkerTask = {
  id: string;
  code: string;
  title: string;
  dueLabel: string;
  assignedBy: {
    name: string;
    department: string;
    initials: string;
    avatarTone: string;
  };
  status: TaskStatus;
};

const STATUS_FILTERS = [
  { id: "all", label: "All Tasks" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
] as const;

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"];

/**
 * Demo rows matching Figma worker Taskboard until a tasks API exists.
 * Assigned-by is limited to Manager/HR to match Admin → Settings → Task
 * ("Manager / HR assignment only", default on).
 */
const DEMO_TASKS: WorkerTask[] = [
  {
    id: "1",
    code: "T01",
    title: "Complete Employee Handbook Acknowledgement",
    dueLabel: "11/27/2026 8AM",
    assignedBy: {
      name: "John Smith",
      department: "HR Department",
      initials: "JS",
      avatarTone: "bg-[#DBEAFE] text-[#1D4ED8]",
    },
    status: "in_progress",
  },
  {
    id: "2",
    code: "T02",
    title: "Confirm your company email",
    dueLabel: "11/15/2026 9AM",
    assignedBy: {
      name: "Miley Cervantes",
      department: "HR Department",
      initials: "MC",
      avatarTone: "bg-[#FCE7F3] text-[#BE185D]",
    },
    status: "in_progress",
  },
  {
    id: "3",
    code: "T03",
    title: "Complete new-hire orientation checklist",
    dueLabel: "11/8/2026 12PM",
    assignedBy: {
      name: "Kevin Lee",
      department: "Manager",
      initials: "KL",
      avatarTone: "bg-[#FFEDD5] text-[#C2410C]",
    },
    status: "pending",
  },
  {
    id: "4",
    code: "T04",
    title: "Update Emergency Contacts",
    dueLabel: "11/5/2026 2AM",
    assignedBy: {
      name: "John Smith",
      department: "HR Department",
      initials: "JS",
      avatarTone: "bg-[#DBEAFE] text-[#1D4ED8]",
    },
    status: "completed",
  },
];

const STATUS_BADGE: Record<TaskStatus, { label: string; className: string }> = {
  in_progress: {
    label: "In Progress",
    className: "bg-[#DBEAFE] text-[#1D4ED8]",
  },
  pending: {
    label: "Pending",
    className: "bg-[#FFEDD5] text-[#C2410C]",
  },
  completed: {
    label: "Completed",
    className: "bg-[#DCFCE7] text-[#15803D]",
  },
};

const PAGE_SIZE_OPTIONS = [4, 10, 25];

export function WorkerTaskboardClient() {
  const [filter, setFilter] = useState<StatusFilterId>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);

  const counts = useMemo(() => {
    const pending = DEMO_TASKS.filter((t) => t.status === "pending").length;
    const inProgress = DEMO_TASKS.filter((t) => t.status === "in_progress").length;
    const completed = DEMO_TASKS.filter((t) => t.status === "completed").length;
    return {
      all: DEMO_TASKS.length,
      pending,
      in_progress: inProgress,
      completed,
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return DEMO_TASKS;
    return DEMO_TASKS.filter((task) => task.status === filter);
  }, [filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} p-5 sm:p-6`}>
        <div className="mb-5">
          <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
            Taskboard
          </h1>
          <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
            Your assigned tasks and required actions.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => {
            const active = filter === item.id;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFilter(item.id);
                  setPage(1);
                }}
                className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition ${
                  active
                    ? "bg-[#012352] text-white"
                    : "border border-[#E5E7EB] bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  <th className="whitespace-nowrap px-4 py-3">#</th>
                  <th className="min-w-[220px] px-4 py-3">Tasks</th>
                  <th className="whitespace-nowrap px-4 py-3">Due</th>
                  <th className="min-w-[200px] px-4 py-3">Assigned by</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6B7280]">
                      No tasks in this filter.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((task) => {
                    const badge = STATUS_BADGE[task.status];
                    const isCompleted = task.status === "completed";
                    const isInProgress = task.status === "in_progress";
                    return (
                      <tr key={task.id} className="border-b border-[#E5E7EB] last:border-b-0">
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#0F172A]">
                          {task.code}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-[#0F172A]">{task.title}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-[#374151]">
                          {task.dueLabel}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${task.assignedBy.avatarTone}`}
                              aria-hidden
                            >
                              {task.assignedBy.initials}
                            </span>
                            <p className="min-w-0 truncate text-sm text-[#0F172A]">
                              <span className="font-medium">{task.assignedBy.name}</span>
                              <span className="text-[#6B7280]"> • {task.assignedBy.department}</span>
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <button
                            type="button"
                            disabled={isCompleted}
                            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                              isCompleted
                                ? "cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]"
                                : "bg-[#012352] text-white hover:brightness-110"
                            }`}
                          >
                            {isInProgress ? (
                              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                            )}
                            {isInProgress ? "Progress" : "Start Task"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#64748B]">
              Showing{" "}
              <span className="font-semibold text-[#0F172A]">
                {filtered.length === 0 ? "0" : `${pageStart}-${pageEnd}`}
              </span>{" "}
              of <span className="font-semibold text-[#0F172A]">{filtered.length}</span> results
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <span>Show</span>
                <ListPaginationShowLabel
                  pageSize={pageSize}
                  options={PAGE_SIZE_OPTIONS}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
              <ListPaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                activeStyle={{ backgroundColor: "#012352", borderColor: "#012352" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
