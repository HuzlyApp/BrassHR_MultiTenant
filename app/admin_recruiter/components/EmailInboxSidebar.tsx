"use client";

import Link from "next/link";
import {
  Archive,
  Inbox,
  LayoutTemplate,
  Link2,
  Pencil,
  Send,
  type LucideIcon,
} from "lucide-react";

export type EmailInboxFolder = "inbox" | "sent" | "drafts" | "compose" | "integration";

export function EmailInboxSidebarNavItem({
  active,
  label,
  icon: Icon,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-2.5 text-left text-sm transition ${
        active
          ? "font-medium text-(--brand-primary)"
          : "text-[#374151] hover:bg-white/80"
      }`}
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-(--brand-primary)" : "text-[#6B7280]"}`} />
        {label}
      </span>
      {typeof count === "number" && count > 0 ? (
        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function EmailInboxSidebarLinkItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm text-[#374151] transition hover:bg-white/80"
    >
      <Icon className="h-4 w-4 shrink-0 text-[#6B7280]" />
      {label}
    </Link>
  );
}

type EmailInboxSidebarProps = {
  folder: EmailInboxFolder;
  inboxCount: number;
  sentCount: number;
  draftsCount?: number;
  emailConfigured: boolean;
  composeDisabled?: boolean;
  onCompose: () => void;
  onFolderChange: (folder: EmailInboxFolder) => void;
  templatesHref?: string;
};

export function EmailInboxSidebar({
  folder,
  inboxCount,
  sentCount,
  draftsCount = 0,
  emailConfigured,
  composeDisabled = false,
  onCompose,
  onFolderChange,
  templatesHref = "/admin_recruiter/email-templates",
}: EmailInboxSidebarProps) {
  return (
    <aside className="col-span-12 flex flex-col border-b border-[#E5E7EB] bg-[#FAFBFC] md:col-span-3 md:border-b-0 md:border-r">
      <div className="p-4">
        <button
          type="button"
          onClick={onCompose}
          disabled={!emailConfigured || composeDisabled}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-(--brand-primary) bg-white px-3 py-2.5 text-sm font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" />
          Compose
        </button>

        <div className="space-y-0.5">
          <EmailInboxSidebarNavItem
            active={folder === "inbox"}
            label="Inbox"
            icon={Inbox}
            count={inboxCount}
            onClick={() => onFolderChange("inbox")}
          />
          <EmailInboxSidebarNavItem
            active={folder === "sent"}
            label="Sent"
            icon={Send}
            count={sentCount}
            onClick={() => onFolderChange("sent")}
          />
          <EmailInboxSidebarNavItem
            active={folder === "drafts"}
            label="Drafts"
            icon={Archive}
            count={draftsCount}
            onClick={() => onFolderChange("drafts")}
          />
        </div>

        <div className="my-4 border-t border-[#E5E7EB]" />

        <div className="space-y-0.5">
          <EmailInboxSidebarLinkItem
            href={templatesHref}
            label="Manage Templates"
            icon={LayoutTemplate}
          />
          <button
            type="button"
            onClick={() => onFolderChange("integration")}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition ${
              folder === "integration"
                ? "font-medium text-(--brand-primary)"
                : "text-[#374151] hover:bg-white/80"
            }`}
          >
            <Link2
              className={`h-4 w-4 shrink-0 ${
                folder === "integration" ? "text-(--brand-primary)" : "text-[#6B7280]"
              }`}
            />
            Email Integration
          </button>
        </div>
      </div>
    </aside>
  );
}
