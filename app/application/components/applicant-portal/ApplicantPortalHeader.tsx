"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { ChevronDown, Menu, Search } from "lucide-react";
import { useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

const ICON_BASE = "/icons/braas-HR/client-dashboard";

type Props = {
  applicantName: string;
  onMenuClick?: () => void;
  onOpenMessages?: () => void;
};

export function ApplicantPortalHeader({ applicantName, onMenuClick, onOpenMessages }: Props) {
  const branding = useTenantBranding();
  const [profileOpen, setProfileOpen] = useState(false);
  const firstName = applicantName.split(" ")[0] || "Applicant";
  const initial = firstName.charAt(0).toUpperCase();
  const avatarStyle = { backgroundColor: branding.primaryHex } as CSSProperties;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-8 w-8 items-center justify-center text-[#64748B] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

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
          <button
            type="button"
            onClick={onOpenMessages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC]"
            aria-label="Open messages"
          >
            <Image src={`${ICON_BASE}/chat-icon.svg`} alt="" width={20} height={20} className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC]"
            aria-label="Notifications"
          >
            <Image src={`${ICON_BASE}/Notification.svg`} alt="" width={20} height={20} className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E11D48]" />
          </button>

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
