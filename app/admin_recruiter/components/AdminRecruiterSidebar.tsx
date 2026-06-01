"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { supabaseBrowser } from "@/lib/supabase-browser";

const SIDEBAR_EXPANDED_WIDTH = 344;
const SIDEBAR_COLLAPSED_WIDTH = 80;

type AdminRecruiterSidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
};

const DEFAULT_TENANT_LOGO = "/images/new-logo-nexus.svg";
const DEFAULT_PROFILE_PHOTO = "https://i.pravatar.cc/128?u=admin-recruiter";

type SidebarProfile = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_photo: string | null;
  email: string | null;
};

type SidebarLink = {
  label: string;
  href: string;
  matchPrefixes: string[];
};

type SidebarSection = {
  label: string;
  href: string;
  icon: string;
  matchPrefixes: string[];
  children?: SidebarLink[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    href: "/admin_recruiter/dashboard",
    icon: "/icons/braas-HR/client-dashboard/dashboard.svg",
    matchPrefixes: ["/admin_recruiter/dashboard"],
    children: [
      {
        label: "Candidates",
        href: "/admin_recruiter/candidates",
        matchPrefixes: ["/admin_recruiter/candidates"],
      },
      { label: "New", href: "/admin_recruiter/new", matchPrefixes: ["/admin_recruiter/new"] },
      { label: "Pending", href: "/admin_recruiter/pending", matchPrefixes: ["/admin_recruiter/pending"] },
      { label: "Approved", href: "/admin_recruiter/approved", matchPrefixes: ["/admin_recruiter/approved"] },
      {
        label: "Disapproved",
        href: "/admin_recruiter/disapproved",
        matchPrefixes: ["/admin_recruiter/disapproved"],
      },
      { label: "Workers", href: "/admin_recruiter/workers", matchPrefixes: ["/admin_recruiter/workers"] },
      {
        label: "Email Templates",
        href: "/admin_recruiter/email-templates",
        matchPrefixes: ["/admin_recruiter/email-templates"],
      },
    ],
  },
  {
    label: "Mail",
    href: "/admin_recruiter/email-templates",
    icon: "/icons/braas-HR/client-dashboard/mail-icon.svg",
    matchPrefixes: ["/admin_recruiter/email-templates"],
  },
  {
    label: "Tickets",
    href: "/admin_recruiter/advanced-search",
    icon: "/icons/braas-HR/client-dashboard/ticket-icon.svg",
    matchPrefixes: ["/admin_recruiter/advanced-search"],
  },
  {
    label: "Reports",
    href: "/admin_recruiter/dashboard",
    icon: "/icons/braas-HR/client-dashboard/report.svg",
    matchPrefixes: ["/admin_recruiter/dashboard"],
  },
  {
    label: "Teams",
    href: "/admin_recruiter/workers",
    icon: "/icons/braas-HR/client-dashboard/teams.svg",
    matchPrefixes: ["/admin_recruiter/workers"],
  },
  {
    label: "Organization",
    href: "/admin_recruiter/settings",
    icon: "/icons/braas-HR/client-dashboard/Organization.svg",
    matchPrefixes: ["/admin_recruiter/settings"],
  },
  {
    label: "Account",
    href: "/admin_recruiter/account/personal",
    icon: "/icons/braas-HR/client-dashboard/Account.svg",
    matchPrefixes: ["/admin_recruiter/account"],
  },
  {
    label: "Notifications",
    href: "/admin_recruiter/notifications",
    icon: "/icons/braas-HR/client-dashboard/Notification.svg",
    matchPrefixes: ["/admin_recruiter/notifications"],
  },
  {
    label: "Help & Support",
    href: "/admin_recruiter/settings",
    icon: "/icons/braas-HR/client-dashboard/help.svg",
    matchPrefixes: ["/admin_recruiter/settings"],
  },
  {
    label: "Settings",
    href: "/admin_recruiter/settings",
    icon: "/icons/braas-HR/client-dashboard/settings.svg",
    matchPrefixes: ["/admin_recruiter/settings"],
  },
];

export function AdminRecruiterSidebar({
  isMobileOpen = false,
  onMobileClose,
  collapsed = false,
}: AdminRecruiterSidebarProps) {
  const branding = useTenantBranding();
  const [logoSrc, setLogoSrc] = useState(branding.logoUrl || DEFAULT_TENANT_LOGO);
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const handleNavClick = () => {
    onMobileClose?.();
  };

  useEffect(() => {
    setLogoSrc(branding.logoUrl?.trim() || DEFAULT_TENANT_LOGO);
  }, [branding.logoUrl]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/header-data", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { profile?: SidebarProfile | null };
        if (!active) return;
        setProfile(payload.profile ?? null);
      } catch {
        /* keep fallback profile */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) return;
    onMobileClose?.();
    router.push("/login");
  };

  const profileName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || profile?.email || "Admin user";
  const profileRole = profile?.role || "Administrator";

  const isPathActive = (prefixes: string[]) => prefixes.some((prefix) => pathname.startsWith(prefix));

  const renderedSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        active: isPathActive(section.matchPrefixes),
        children:
          section.children?.map((child) => ({
            ...child,
            active: isPathActive(child.matchPrefixes),
          })) ?? [],
      })),
    [pathname]
  );

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const SidebarContent = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC]">
      <div className={`border-b border-[#E2E8F0] ${isCollapsed ? "px-2 py-3" : "px-4 py-3"}`}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white"
            style={{ borderColor: "color-mix(in srgb, var(--brand-primary) 55%, #CBD5E1)" }}
          >
            <img
              src={logoSrc}
              alt={branding.companyName}
              className="max-h-[40px] max-w-[40px] object-contain"
              width={40}
              height={40}
              onError={() => setLogoSrc(DEFAULT_TENANT_LOGO)}
            />
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[18px] leading-[28px] font-semibold text-[#0F3B76]">{branding.companyName}</p>
              <p className="text-[10px] leading-[15px] font-light uppercase tracking-normal text-[#94A3B8]">
                Dashboard
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? "px-2 py-3" : "px-3 py-3"}`}>
        {renderedSections.map((section) => (
          <div key={section.label} className="mb-1">
            <Link
              href={section.href}
              onClick={handleNavClick}
              title={isCollapsed ? section.label : undefined}
              className={`flex min-h-[36px] items-center rounded-md transition hover:bg-white ${
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2 py-1"
              }`}
              style={
                section.active
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--brand-accent) 12%, white)",
                    }
                  : undefined
              }
            >
              <Image src={section.icon} alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
              {!isCollapsed ? (
                <>
                  <span className="font-light text-[14px] leading-5 tracking-normal text-[#1E3A6D]">{section.label}</span>
                  {section.children?.length ? <span className="ml-auto text-[#9CA3AF]">›</span> : null}
                </>
              ) : null}
            </Link>

            {!isCollapsed && section.children?.length ? (
              <div className="ml-7 mt-0.5 space-y-0.5">
                {section.children.map((child) => (
                  <Link
                    key={`${section.label}-${child.label}`}
                    href={child.href}
                    onClick={handleNavClick}
                    className="block rounded-md px-2 py-1.5 font-light text-[14px] leading-5 tracking-normal transition"
                    style={
                      child.active
                        ? {
                            color: "var(--brand-secondary)",
                            backgroundColor: "color-mix(in srgb, var(--brand-accent) 10%, white)",
                          }
                        : { color: "#1E3A6D" }
                    }
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className={`border-t border-[#E2E8F0] ${isCollapsed ? "px-2 py-3" : "px-4 py-3"}`}>
        <div className={`flex items-center ${isCollapsed ? "flex-col gap-2" : "gap-2.5"}`}>
          <img
            src={profile?.profile_photo || DEFAULT_PROFILE_PHOTO}
            alt={profileName}
            title={isCollapsed ? profileName : undefined}
            className="h-[30px] w-[30px] shrink-0 rounded-full object-cover"
            width={30}
            height={30}
          />
          {!isCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] leading-5 font-semibold text-[#0F2F60]">{profileName}</p>
              <p className="truncate text-[10px] leading-[15px] font-light text-[#94A3B8]">{profileRole}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`rounded-md p-1 hover:bg-white/80 ${isCollapsed ? "" : "ml-auto"}`}
          >
            <Image
              src="/icons/braas-HR/client-dashboard/logout.svg"
              alt="Logout"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          </button>
        </div>
      </div>
    </div>
  );

  const asideStyle = {
    width: sidebarWidth,
    maxWidth: sidebarWidth,
    minWidth: SIDEBAR_COLLAPSED_WIDTH,
    boxShadow: "inset 3px 0 0 var(--brand-primary)",
  };

  return (
    <>
      <aside
        className="admin-recruiter-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[#E2E8F0] transition-[width] duration-200 ease-in-out lg:block"
        style={asideStyle}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <SidebarContent isCollapsed={collapsed} />
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity lg:hidden ${
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
        aria-hidden={!isMobileOpen}
      >
        <aside
          className={`h-full border-r border-[#E2E8F0] transition-transform ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            width: SIDEBAR_EXPANDED_WIDTH,
            maxWidth: "90vw",
            boxShadow: "inset 3px 0 0 var(--brand-primary)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <SidebarContent isCollapsed={false} />
        </aside>
      </div>
    </>
  );
}

export { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH };
