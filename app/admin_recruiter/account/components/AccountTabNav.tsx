"use client";

import Link from "next/link";
import { ACCOUNT_TAB_NAV, accountTabHref, type AccountTabSlug } from "../account-tabs";

type AccountTabNavProps = {
  activeTab: AccountTabSlug;
};

export default function AccountTabNav({ activeTab }: AccountTabNavProps) {
  const normalizedActive =
    activeTab === "account-settings" || activeTab === "security"
      ? "account-security"
      : activeTab;

  return (
    <nav
      className="mb-4 flex flex-nowrap items-stretch gap-6 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Account sections"
    >
      {ACCOUNT_TAB_NAV.map((tab) => {
        const isActive = tab.slug === normalizedActive;
        return (
          <Link
            key={tab.slug}
            href={accountTabHref(tab.slug)}
            className={`relative shrink-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
              isActive
                ? ""
                : "text-[#2B3D51] hover:text-[var(--brand-primary,#BC8B41)]"
            }`}
            style={
              isActive
                ? { color: "var(--brand-primary, #BC8B41)" }
                : undefined
            }
          >
            {tab.label}
            {isActive ? (
              <span
                className="absolute bottom-0 left-0 h-[3px] w-full rounded-full"
                style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
