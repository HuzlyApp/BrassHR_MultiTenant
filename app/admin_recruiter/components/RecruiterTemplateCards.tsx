"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Eye,
  FileText,
  Folder,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { RecruiterTemplateListItem } from "@/lib/recruiter-templates/types";
import {
  folderPrimaryBadge,
  formatFolderStatusLine,
  type FolderStatusCounts,
  type RecruiterTemplateFolder,
} from "@/lib/recruiter-templates/template-folders-storage";

const NAVY = "#012352";

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "archived":
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
    default:
      return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }
}

function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

export type TemplateCardAction = "duplicate" | "move" | "archive" | "delete" | "signing-request";

export function TemplateCard({
  template,
  busy,
  showDefaultBadge,
  onAction,
}: {
  template: RecruiterTemplateListItem;
  busy?: boolean;
  showDefaultBadge?: boolean;
  onAction: (action: TemplateCardAction) => void;
}) {
  const menu = useMenu();
  const badgeLabel = showDefaultBadge && template.status === "active" ? "Default" : template.status;

  return (
    <div className="group relative z-0 flex min-w-0 max-w-full items-start gap-3 rounded-xl border border-[#EAECF0] bg-white p-4 transition hover:z-30 hover:border-[#D0D5DD] hover:shadow-sm max-[449px]:gap-2 max-[449px]:p-3 has-[[aria-expanded=true]]:z-30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#012352] max-[449px]:h-8 max-[449px]:w-8">
        <FileText className="h-5 w-5 max-[449px]:h-4 max-[449px]:w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin_recruiter/template-builder/${template.id}`}
              className="block truncate text-sm font-semibold text-[#101828] hover:text-[color:var(--brand-primary,#012352)] max-[449px]:text-xs"
            >
              {template.name}
            </Link>
            {template.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-[#667085] max-[449px]:text-[0.65rem]">
                {template.description}
              </p>
            ) : null}
          </div>
          <div className="relative shrink-0" ref={menu.ref}>
            <button
              type="button"
              disabled={busy}
              aria-label="Template actions"
              aria-expanded={menu.open}
              onClick={() => menu.setOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7] disabled:opacity-50"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu.open ? (
              <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border border-[#EAECF0] bg-white py-1 shadow-lg">
                <Link
                  href={`/admin_recruiter/template-builder/${template.id}`}
                  className="block px-3 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]"
                  onClick={() => menu.setOpen(false)}
                >
                  Edit
                </Link>
                <Link
                  href={`/admin_recruiter/template-builder/${template.id}?preview=1`}
                  className="block px-3 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]"
                  onClick={() => menu.setOpen(false)}
                >
                  Preview
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[#344054] hover:bg-[#F9FAFB]"
                  onClick={() => {
                    menu.setOpen(false);
                    onAction("duplicate");
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[#344054] hover:bg-[#F9FAFB]"
                  onClick={() => {
                    menu.setOpen(false);
                    onAction("move");
                  }}
                >
                  Move to another folder
                </button>
                {template.status === "active" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[#344054] hover:bg-[#F9FAFB]"
                    onClick={() => {
                      menu.setOpen(false);
                      onAction("signing-request");
                    }}
                  >
                    Signing request
                  </button>
                ) : null}
                {template.status !== "archived" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FEF3F2]"
                    onClick={() => {
                      menu.setOpen(false);
                      onAction("archive");
                    }}
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FEF3F2]"
                    onClick={() => {
                      menu.setOpen(false);
                      onAction("delete");
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${statusBadgeClass(
              showDefaultBadge && template.status === "active" ? "active" : template.status
            )}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FolderCard({
  folder,
  counts,
  href,
  onRename,
  onDelete,
}: {
  folder: RecruiterTemplateFolder;
  counts: FolderStatusCounts;
  href: string;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const menu = useMenu();
  const badge = folderPrimaryBadge(counts);

  return (
    <div className="group relative z-0 min-w-0 max-w-full rounded-xl border border-[#EAECF0] bg-white p-4 transition hover:z-30 hover:border-[#D0D5DD] hover:shadow-sm max-[449px]:p-3 has-[[aria-expanded=true]]:z-30">
      <div className="flex min-w-0 items-start gap-3 max-[449px]:gap-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg max-[449px]:h-8 max-[449px]:w-8"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #012352) 10%, white)" }}
        >
          <Folder
            className="h-5 w-5 text-[color:var(--brand-primary,#012352)] max-[449px]:h-4 max-[449px]:w-4"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={href}
                className="block truncate text-sm font-semibold text-[#101828] hover:text-[color:var(--brand-primary,#012352)] max-[449px]:text-xs"
              >
                {folder.name}
              </Link>
              <p className="mt-1 text-xs text-[#667085]">{formatFolderStatusLine(counts)}</p>
            </div>
            <div className="relative shrink-0" ref={menu.ref}>
              <button
                type="button"
                aria-label="Folder actions"
                aria-expanded={menu.open}
                onClick={() => menu.setOpen((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[#F2F4F7] data-[open=true]:opacity-100"
                data-open={menu.open}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menu.open ? (
                <div className="absolute right-0 z-40 mt-1 w-40 rounded-lg border border-[#EAECF0] bg-white py-1 shadow-lg">
                  <Link
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]"
                    onClick={() => menu.setOpen(false)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  {onRename ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#344054] hover:bg-[#F9FAFB]"
                      onClick={() => {
                        menu.setOpen(false);
                        onRename();
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#B42318] hover:bg-[#FEF3F2]"
                      onClick={() => {
                        menu.setOpen(false);
                        onDelete();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusBadgeClass(
                badge.toLowerCase()
              )}`}
            >
              {badge}
            </span>
            <div className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
              <Link
                href={href}
                className="inline-flex h-7 items-center rounded-md border border-[#D0D5DD] px-2 text-[11px] font-medium text-[#344054] hover:bg-[#F9FAFB]"
              >
                View
              </Link>
              {onRename ? (
                <button
                  type="button"
                  onClick={onRename}
                  className="inline-flex h-7 items-center rounded-md border border-[#D0D5DD] px-2 text-[11px] font-medium text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Edit
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-sm font-semibold text-[#101828] sm:text-base">{title}</h2>
      {typeof count === "number" ? (
        <span className="text-xs font-medium text-[#98A2B3]">{count}</span>
      ) : null}
    </div>
  );
}

export { NAVY };
