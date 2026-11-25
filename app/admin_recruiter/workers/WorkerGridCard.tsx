"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import { candidateMailHref } from "@/app/admin_recruiter/candidates/candidate-links";
import { CANDIDATE_CARD_SURFACE_CLASS } from "@/app/admin_recruiter/candidates/candidate-card-surface";
import { adminWorkerProfileHref } from "./worker-profile-links";
import type { WorkerListRow } from "./figma-demo-data";

type WorkerGridCardProps = {
  worker: WorkerListRow;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenActionsMenu: (worker: WorkerListRow, anchor: HTMLElement) => void;
  actionsMenuOpen: boolean;
};

function workerStatusClass(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower === "inactive" || statusLower === "terminated") {
    return "bg-[#94A3B8] text-white";
  }
  return "bg-[#14B8A6] text-white";
}

export function WorkerGridCard({
  worker,
  selected,
  onToggleSelect,
  onOpenActionsMenu,
  actionsMenuOpen,
}: WorkerGridCardProps) {
  const profileHref = adminWorkerProfileHref(worker.profileId);
  const surfaceClass = selected
    ? "rounded-lg border-2 border-[color:var(--brand-primary)] bg-white p-3.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand-primary)_35%,transparent)] transition"
    : CANDIDATE_CARD_SURFACE_CLASS;

  return (
    <article className={`relative ${surfaceClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="pt-0.5">
            <ListTableCheckbox
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${worker.name}`}
            />
          </div>
          <CandidateListAvatar
            name={worker.name || "NA"}
            photoUrl={worker.profilePhotoUrl}
            size="md"
          />
          <div className="min-w-0">
            <Link
              href={profileHref}
              className="block truncate text-sm font-semibold text-[#111827] hover:underline"
              title={worker.name}
            >
              {worker.name || "Unnamed"}
            </Link>
            <p className="mt-0.5 truncate text-xs text-[#6B7280]">
              {worker.experience || worker.jobRole || "—"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5" data-worker-action-menu>
          <Link
            href={profileHref}
            className="inline-flex items-center justify-center rounded-full border border-[#D1D5DB] bg-white px-3 py-1 text-xs font-medium text-[#374151] shadow-2xs transition hover:bg-gray-50"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActionsMenu(worker, e.currentTarget);
            }}
            className={`flex size-7 items-center justify-center rounded-full transition ${
              actionsMenuOpen
                ? "bg-gray-100 text-gray-700"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            }`}
            aria-label="More options"
            title="More options"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
        <span className="truncate text-xs text-[#6B7280]" title={worker.client || undefined}>
          {worker.client || "No client"}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${workerStatusClass(
            worker.status || "Active"
          )}`}
        >
          {worker.status || "Active"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[#4f6462]">
        <div className="truncate">
          <span className="text-[#6B7280]">Role · </span>
          <span className="text-[#111827]">{worker.jobRole || "—"}</span>
        </div>
        <div className="truncate">
          <span className="text-[#6B7280]">Email · </span>
          {worker.email ? (
            <Link
              href={candidateMailHref(worker.profileId)}
              className="text-[#111827] hover:text-[color:var(--brand-primary)] hover:underline"
            >
              {worker.email}
            </Link>
          ) : (
            <span className="text-[#111827]">—</span>
          )}
        </div>
        <div className="truncate">
          <span className="text-[#6B7280]">Phone · </span>
          <span className="text-[#111827]">{worker.phone || "—"}</span>
        </div>
        {worker.payRate ? (
          <div className="truncate">
            <span className="text-[#6B7280]">Pay · </span>
            <span className="text-[#111827]">{worker.payRate}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
