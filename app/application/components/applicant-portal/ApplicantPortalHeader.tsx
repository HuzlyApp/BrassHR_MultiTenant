"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { ChevronDown, Menu, Search } from "lucide-react";
import { useState } from "react";
import SidebarNavIcon from "@/app/admin_recruiter/components/SidebarNavIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

const SIDEBAR_TOGGLE_ICON = "/icons/sidebar-on-off-icon.svg";

type Props = {
  applicantName: string;
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  onOpenMessages?: () => void;
};

export function ApplicantPortalHeader({
  applicantName,
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed = false,
  onOpenMessages,
}: Props) {
  const branding = useTenantBranding();
  const [profileOpen, setProfileOpen] = useState(false);
  const firstName = applicantName.split(" ")[0] || "Applicant";
  const initial = firstName.charAt(0).toUpperCase();
  const avatarStyle = { backgroundColor: branding.primaryHex } as CSSProperties;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-8 w-8 items-center justify-center text-[#64748B] transition hover:text-[#0F3B76] lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {onSidebarToggle ? (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="hidden h-8 w-8 items-center justify-center text-[#64748B] transition hover:text-[#0F3B76] lg:inline-flex"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            >
              <Image
                src={SIDEBAR_TOGGLE_ICON}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        <div className="hidden flex-1 justify-center lg:flex">
          <label className="relative w-full max-w-[520px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              placeholder="Search anything"
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-10 pr-4 text-[14px] text-[#012352] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={onOpenMessages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F8FAFC]"
              aria-label="Open messages"
            >
              <SidebarNavIcon iconType="Chat" active={false} />
            </button>
            <button
              type="button"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F8FAFC]"
              aria-label="Notifications"
            >
              <SidebarNavIcon iconType="Notifications" active={false} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E11D48]" />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-2.5 py-1.5"
            >
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[14px] font-semibold text-white"
                style={avatarStyle}
              >
                {initial}
              </span>
              <span className="hidden text-[14px] font-semibold text-black sm:inline">{firstName}.</span>
              <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-12 w-48 rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-[12px] font-semibold text-[#012352]">{applicantName}</p>
                <p className="px-2 pb-2 text-[11px] text-[#64748B]">Applicant</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
