"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Archive, ExternalLink, MoreHorizontal, PlusSquare, SquarePen, Trash2 } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import {
  analyzedApplicantCount,
  applicantCount,
  jobCandidatesHref,
  jobDisplayId,
  jobListDisplayTitle,
  jobLocation,
  publicJobPathFor,
  readyToSubmitCount,
  strongMatchCount,
  type JobListRow,
} from "./render-job-list-cell";

type JobsGridViewProps = {
  jobs: JobListRow[];
  loading: boolean;
  emptyMessage: string;
  tenantSlug: string | null;
  hotJobIds?: Set<string>;
  onAddCandidate: (job: JobListRow) => void;
  onDelete: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  onUnarchive: (jobId: string) => void;
};

const MENU_WIDTH = 168;
const MENU_ESTIMATED_HEIGHT = 180;
const MENU_ITEM_CLASS =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-[color:var(--brand-secondary)] transition hover:bg-[color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
const MENU_ICON_CLASS = "h-4 w-4 shrink-0 text-[#94A3B8]";

function gridStatusLabel(job: JobListRow): string {
  const status = normalizeJobRequisitionStatus(String(job.status ?? ""));
  if (status === "published" && isJobRequisitionOpen(job)) return "OPEN";
  if (status === "draft") return "DRAFT";
  if (status === "closed") return "CLOSED";
  if (status === "archived") return "ARCHIVED";
  return status.toUpperCase();
}

function iconButtonClass(disabled?: boolean) {
  return `inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#475569] ${
    disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-[#94A3B8]" : ""
  }`;
}

function JobGridCardMenu({
  job,
  anchor,
  onClose,
  onAddCandidate,
  onDelete,
  onArchive,
  onUnarchive,
}: {
  job: JobListRow;
  anchor: HTMLElement;
  onClose: () => void;
  onAddCandidate: (job: JobListRow) => void;
  onDelete: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  onUnarchive: (jobId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const archived = normalizeJobRequisitionStatus(String(job.status ?? "")) === "archived";

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + MENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - MENU_ESTIMATED_HEIGHT - 4);
    }
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setStyle({
      position: "fixed",
      top,
      left,
      width: MENU_WIDTH,
      visibility: "visible",
    });
  }, [anchor]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchor, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Job actions"
      style={{ ...brandVars, ...style }}
      className="z-[200] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM_CLASS}
        onClick={() => {
          onClose();
          onAddCandidate(job);
        }}
      >
        <PlusSquare className={MENU_ICON_CLASS} aria-hidden />
        Add
      </button>
      {!archived ? (
        <Link
          href={`/admin_recruiter/jobs/${job.id}/edit`}
          role="menuitem"
          className={MENU_ITEM_CLASS}
          onClick={onClose}
        >
          <SquarePen className={MENU_ICON_CLASS} aria-hidden />
          Edit
        </Link>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM_CLASS}
        onClick={() => {
          onClose();
          onDelete(job.id);
        }}
      >
        <Trash2 className={MENU_ICON_CLASS} aria-hidden />
        Delete
      </button>
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM_CLASS}
        onClick={() => {
          onClose();
          if (archived) onUnarchive(job.id);
          else onArchive(job.id);
        }}
      >
        <Archive className={MENU_ICON_CLASS} aria-hidden />
        {archived ? "Unarchive" : "Archive"}
      </button>
    </div>,
    document.body
  );
}

function JobGridCard({
  job,
  tenantSlug,
  isHot,
  menuOpen,
  onOpenMenu,
}: {
  job: JobListRow;
  tenantSlug: string | null;
  isHot: boolean;
  menuOpen: boolean;
  onOpenMenu: (job: JobListRow, anchor: HTMLElement) => void;
}) {
  const title = jobListDisplayTitle(job);
  const location = jobLocation(job);
  const publicHref = publicJobPathFor(job, tenantSlug);
  const candidateCount = applicantCount(job);
  const candidatesHref = jobCandidatesHref(job.id);
  const metrics = [
    {
      label: "CAND",
      value: candidateCount,
      href: candidatesHref,
      ariaLabel: `View ${candidateCount} candidate${candidateCount === 1 ? "" : "s"} for ${title}`,
    },
    { label: "ANALYSIS", value: analyzedApplicantCount(job) },
    { label: "STRONG", value: strongMatchCount(job) },
    { label: "READY", value: readyToSubmitCount(job) },
  ];

  return (
    <article className="flex flex-col rounded-[12px] border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin_recruiter/jobs/${job.id}`}
            className="block truncate text-sm font-semibold leading-5 text-[#0F172A] hover:underline"
          >
            {title}
          </Link>
          <p className="mt-1 truncate text-xs leading-4 text-[#64748B]">{location}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex h-7 items-center justify-center rounded-full border-2 border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-[#0F172A]">
            {gridStatusLabel(job)}
          </span>
          {isHot ? (
            <span className="inline-flex h-7 items-center justify-center rounded-full bg-[#EF4444] px-3 text-[11px] font-semibold leading-none tracking-[0.02em] text-white">
              Hot
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        {metrics.map((metric) => {
          const metricClassName =
            "flex min-h-[42px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg bg-[#F8F8F8] px-1 py-1.5";
          const body = (
            <>
              <p className="text-base font-semibold leading-5 text-[#0F172A]">{metric.value}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#94A3B8]">
                {metric.label}
              </p>
            </>
          );
          if ("href" in metric && metric.href) {
            return (
              <Link
                key={metric.label}
                href={metric.href}
                aria-label={metric.ariaLabel}
                title={metric.ariaLabel}
                className={`${metricClassName} cursor-pointer transition hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]`}
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={metric.label} className={metricClassName}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3">
        <p className="truncate text-xs text-[#64748B]">
          Job ID: <span className="font-semibold text-[#334155]">{jobDisplayId(job)}</span>
        </p>
        <div className="flex shrink-0 items-center">
          {publicHref ? (
            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className={iconButtonClass()}
              aria-label={`Open public page for ${title}`}
              title="Public view"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={iconButtonClass(true)} title="Publish this job to view the public page">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </span>
          )}
          <button
            type="button"
            className={`${iconButtonClass()} ${menuOpen ? "bg-[#F1F5F9] text-[#475569]" : ""}`}
            aria-label={`More actions for ${title}`}
            title="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              onOpenMenu(job, event.currentTarget);
            }}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

export function JobsGridView({
  jobs,
  loading,
  emptyMessage,
  tenantSlug,
  hotJobIds,
  onAddCandidate,
  onDelete,
  onArchive,
  onUnarchive,
}: JobsGridViewProps) {
  const [openMenu, setOpenMenu] = useState<{ job: JobListRow; anchor: HTMLElement } | null>(null);

  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-[#64748B]">Loading jobs…</p>;
  }

  if (jobs.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-[#64748B]">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {jobs.map((job) => (
          <JobGridCard
            key={job.id}
            job={job}
            tenantSlug={tenantSlug}
            isHot={hotJobIds?.has(job.id) ?? false}
            menuOpen={openMenu?.job.id === job.id}
            onOpenMenu={(nextJob, anchor) => {
              setOpenMenu((current) =>
                current?.job.id === nextJob.id ? null : { job: nextJob, anchor }
              );
            }}
          />
        ))}
      </div>
      {openMenu ? (
        <JobGridCardMenu
          job={openMenu.job}
          anchor={openMenu.anchor}
          onClose={() => setOpenMenu(null)}
          onAddCandidate={onAddCandidate}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />
      ) : null}
    </>
  );
}
