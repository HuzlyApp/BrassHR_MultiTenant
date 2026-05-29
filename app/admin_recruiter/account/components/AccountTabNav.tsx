"use client";

import Link from "next/link";
import { ACCOUNT_TABS, type AccountTabSlug } from "../account-tabs";

type AccountTabNavProps = {
  activeTab: AccountTabSlug;
};

export default function AccountTabNav({ activeTab }: AccountTabNavProps) {
  return (
    <nav
      className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-[#E5E7EB]"
      aria-label="Account sections"
    >
      {ACCOUNT_TABS.map((tab) => {
        const isActive = tab.slug === activeTab;
        return (
          <Link
            key={tab.slug}
            href={`/admin_recruiter/account/${tab.slug}`}
            className={`shrink-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
              isActive
                ? "-mb-px border-b-2 text-[var(--brand-primary,#BC8B41)]"
                : "border-b-2 border-transparent text-[#2B3D51] hover:text-[var(--brand-primary,#BC8B41)]"
            }`}
            style={
              isActive
                ? { borderBottomColor: "var(--brand-primary, #BC8B41)" }
                : undefined
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
