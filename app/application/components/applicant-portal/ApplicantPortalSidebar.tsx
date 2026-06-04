"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { supabaseBrowser } from "@/lib/supabase-browser";

const GOLD = "#BC8B41";
const ICON_BASE = "/icons/braas-HR/client-dashboard";

type NavItem = {
  label: string;
  icon?: string;
  lucideIcon?: React.ReactNode;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: { label: string; disabled?: boolean }[];
};

type Props = {
  applicantName: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenMessages?: () => void;
};

export function ApplicantPortalSidebar({
  applicantName,
  mobileOpen = false,
  onMobileClose,
  onOpenMessages,
}: Props) {
  const branding = useTenantBranding();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string[]>(["Finance", "Teams"]);
  const firstName = applicantName.split(" ")[0] || "Applicant";
  const initial = firstName.charAt(0).toUpperCase();

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      icon: `${ICON_BASE}/dashboard.svg`,
      href: "/application/applicant-dashboard",
    },
    { label: "Mail", icon: `${ICON_BASE}/mail-icon.svg`, disabled: true },
    {
      label: "Chat",
      icon: `${ICON_BASE}/chat-icon.svg`,
      onClick: onOpenMessages,
    },
    {
      label: "Schedule",
      lucideIcon: <Calendar className="h-5 w-5 shrink-0" strokeWidth={1.75} />,
      href: "/application/applicant-dashboard",
      active: true,
    },
    { label: "Tickets", icon: `${ICON_BASE}/ticket-icon.svg`, disabled: true },
    { label: "Reports", icon: `${ICON_BASE}/report.svg`, disabled: true },
    {
      label: "Finance",
      icon: `${ICON_BASE}/finance.svg`,
      disabled: true,
      children: [
        { label: "Billing", disabled: true },
        { label: "Invoices", disabled: true },
      ],
    },
    {
      label: "Teams",
      icon: `${ICON_BASE}/teams.svg`,
      disabled: true,
      children: [
        { label: "Managers", disabled: true },
        { label: "Teams", disabled: true },
      ],
    },
    { label: "Account", icon: `${ICON_BASE}/Account.svg`, disabled: true },
    { label: "Notifications", icon: `${ICON_BASE}/Notification.svg`, disabled: true },
    { label: "Help & Support", icon: `${ICON_BASE}/help.svg`, disabled: true },
    { label: "Settings", icon: `${ICON_BASE}/settings.svg`, disabled: true },
  ];

  const sidebarBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#E2E8F0] p-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white"
            style={{ borderColor: GOLD }}
          >
            <img
              src={branding.logoUrl || "/images/new-logo-nexus.svg"}
              alt=""
              className="max-h-6 max-w-6 object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold leading-7 text-[#012352]">{firstName}</p>
            <p className="text-[10px] font-light uppercase leading-[15px] text-[#BC8B41]">Dashboard</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-5 py-5">
        {navItems.map((item) => {
          const isOpen = expanded.includes(item.label);
          const isGold = item.active;

          const rowContent = (
            <>
              {item.icon ? (
                <Image
                  src={item.icon}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0"
                  style={
                    isGold
                      ? {
                          filter:
                            "brightness(0) saturate(100%) invert(62%) sepia(40%) saturate(785%) hue-rotate(359deg)",
                        }
                      : undefined
                  }
                />
              ) : (
                item.lucideIcon
              )}
              <span
                className={`text-[14px] leading-5 ${isGold ? "font-normal text-[#BC8B41]" : "font-light text-[#012352]"}`}
              >
                {item.label}
              </span>
            </>
          );

          return (
            <div key={item.label}>
              {item.children?.length ? (
                <div
                  className={`flex items-center gap-3 rounded-md py-1 pr-3 ${isGold ? "text-[#BC8B41]" : "text-[#012352]"}`}
                >
                  {item.disabled ? (
                    <div className="flex flex-1 items-center gap-3 opacity-70">{rowContent}</div>
                  ) : (
                    <Link href={item.href ?? "#"} onClick={onMobileClose} className="flex flex-1 items-center gap-3">
                      {rowContent}
                    </Link>
                  )}
                  <button
                    type="button"
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                    onClick={() =>
                      setExpanded((prev) =>
                        prev.includes(item.label) ? prev.filter((l) => l !== item.label) : [...prev, item.label]
                      )
                    }
                    className="text-[#94A3B8]"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    onMobileClose?.();
                  }}
                  className="flex w-full items-center gap-3 rounded-md py-1 pr-3 text-left text-[#012352] transition hover:text-[#BC8B41]"
                >
                  {rowContent}
                </button>
              ) : item.disabled ? (
                <div className="flex items-center gap-3 rounded-md py-1 pr-3 opacity-60" aria-disabled>
                  {rowContent}
                </div>
              ) : (
                <Link
                  href={item.href ?? "#"}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 rounded-md py-1 pr-3 transition ${
                    isGold ? "text-[#BC8B41]" : "text-[#012352] hover:text-[#BC8B41]"
                  }`}
                >
                  {rowContent}
                </Link>
              )}

              {item.children?.length && isOpen ? (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <div
                      key={child.label}
                      className="py-1 text-[14px] font-light leading-5 text-[#012352] opacity-60"
                      aria-disabled
                    >
                      {child.label}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#E2E8F0] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
              style={{ backgroundColor: GOLD }}
            >
              {initial}
            </div>
            <span className="truncate text-[14px] font-semibold text-black">{firstName}.</span>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              router.replace("/");
            }}
            className="opacity-80 transition hover:opacity-100"
          >
            <Image src={`${ICON_BASE}/logout.svg`} alt="" width={20} height={20} className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[272px] transform border-r border-[#E2E8F0] transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarBody}
      </aside>
    </>
  );
}
