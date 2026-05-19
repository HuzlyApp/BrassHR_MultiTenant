"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { supabaseBrowser } from "@/lib/supabase-browser";

const CANDIDATE_SUB = [
  { label: "All", href: "/admin_recruiter/candidates" },
  { label: "New", href: "/admin_recruiter/new" },
  { label: "Pending", href: "/admin_recruiter/pending" },
  { label: "Approved", href: "/admin_recruiter/approved" },
  { label: "Disapproved", href: "/admin_recruiter/disapproved" },
] as const;

const WORKER_SUB = [
  { label: "Active", href: "/admin_recruiter/workers" },
  { label: "Inactive", href: "/admin_recruiter/workers" },
  { label: "Cancelled", href: "/admin_recruiter/workers" },
  { label: "Banned", href: "/admin_recruiter/workers" },
] as const;

type AdminRecruiterSidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

const DEFAULT_TENANT_LOGO = "/images/new-logo-nexus.svg";

export function AdminRecruiterSidebar({ isMobileOpen = false, onMobileClose }: AdminRecruiterSidebarProps) {
  const branding = useTenantBranding();
  const [logoSrc, setLogoSrc] = useState(branding.logoUrl || DEFAULT_TENANT_LOGO);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const inDashboard = pathname.startsWith("/admin_recruiter/dashboard");
  const inCandidates =
    pathname.startsWith("/admin_recruiter/candidates") ||
    pathname.startsWith("/admin_recruiter/new") ||
    pathname.startsWith("/admin_recruiter/pending") ||
    pathname.startsWith("/admin_recruiter/approved") ||
    pathname.startsWith("/admin_recruiter/disapproved");
  const inWorkers = pathname.startsWith("/admin_recruiter/workers");
  const inCalendar = pathname.startsWith("/admin_recruiter/calendar");
  const inJobs = pathname.startsWith("/admin_recruiter/jobs");
  const inNotifications = pathname.startsWith("/admin_recruiter/notifications");
  const inSettings = pathname.startsWith("/admin_recruiter/settings");
  const inEmailTemplates = pathname.startsWith("/admin_recruiter/email-templates");
  const inMessages = pathname.startsWith("/admin_recruiter/messages");

  type RailIcon = {
    src: string;
    alt: string;
    active: boolean;
    href?: string;
  };

  const railIcons: RailIcon[] = useMemo(
    () => [
      { src: "/icons/admin-recruiter/dashboard-icon.svg", alt: "Dashboard", active: inDashboard, href: "/admin_recruiter/dashboard" },
      { src: "/icons/admin-recruiter/user-setting.svg", alt: "Candidates", active: inCandidates, href: "/admin_recruiter/candidates" },
      { src: "/icons/admin-recruiter/groups.svg", alt: "Workers", active: inWorkers, href: "/admin_recruiter/workers" },
      { src: "/icons/admin-recruiter/calender.svg", alt: "Calendar", active: inCalendar, href: "/admin_recruiter/calendar" },
      { src: "/icons/admin-recruiter/switch-icon.svg", alt: "Jobs", active: inJobs, href: "/admin_recruiter/jobs" },
      { src: "/icons/admin-recruiter/chat.svg", alt: "Messages", active: inMessages, href: "/admin_recruiter/messages" },
      { src: "/icons/admin-recruiter/bell-02.svg", alt: "Notification", active: inNotifications, href: "/admin_recruiter/notifications" },
      { src: "/icons/admin-recruiter/setting.svg", alt: "Setting", active: inSettings, href: "/admin_recruiter/settings" },
    ],
    [inCalendar, inCandidates, inDashboard, inJobs, inMessages, inNotifications, inSettings, inWorkers]
  );

  const handleNavClick = (label: string, href: string) => {
    console.log("[AdminRecruiterSidebar] clicked sidebar item", { label, href, currentRoute: pathname });
    onMobileClose?.();
  };

  useEffect(() => {
    console.log("[AdminRecruiterSidebar] current route", pathname);
  }, [pathname]);

  useEffect(() => {
    setLogoSrc(branding.logoUrl?.trim() || DEFAULT_TENANT_LOGO);
  }, [branding.logoUrl]);

  const handleLogout = async () => {
    console.log("[AdminRecruiterSidebar] clicked sidebar item", { label: "Logout", currentRoute: pathname });
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) {
      console.error("[AdminRecruiterSidebar] Supabase logout error", error);
      return;
    }
    onMobileClose?.();
    router.push("/login");
  };

  const SidebarContent = () => (
    <div className="relative h-full">
      <div
        className="absolute inset-y-0 left-0 w-20 text-[#d4efea] flex flex-col items-center py-3 pb-5"
        style={{ backgroundColor: "var(--brand-secondary)" }}
      >
        <div className="mt-1 mb-6 flex h-[46px] w-[46px] items-center justify-center overflow-hidden">
          <img
            src={logoSrc}
            alt={branding.companyName}
            className="max-h-[46px] max-w-[46px] object-contain"
            width={46}
            height={46}
            onError={() => setLogoSrc(DEFAULT_TENANT_LOGO)}
          />
        </div>
        <div className="mb-4 px-1 text-center text-[10px] leading-3 text-white/90">
          {branding.companyName}
        </div>

        <div className="flex flex-col items-center">
          {railIcons.map((icon) => {
            const cls = `h-[72px] w-20 flex items-center justify-center cursor-pointer transition ${
              icon.active ? "shadow-[inset_3px_0_0_0_var(--brand-accent)]" : ""
            }`;
            const iconStyle = icon.active
              ? ({ backgroundColor: "var(--brand-primary)" } as const)
              : ({ backgroundColor: "transparent" } as const);

            if (icon.href) {
              return (
                <Link
                  key={icon.src}
                  href={icon.href}
                  className={cls}
                  style={iconStyle}
                  aria-label={icon.alt}
                  onClick={() => handleNavClick(icon.alt, icon.href ?? "")}
                >
                  <Image src={icon.src} alt={icon.alt} width={32} height={32} />
                </Link>
              );
            }

            return (
              <div key={icon.src} className={cls} style={iconStyle}>
                <Image src={icon.src} alt={icon.alt} width={32} height={32} />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto h-[72px] w-20 flex items-center justify-center cursor-pointer transition hover:opacity-90"
          aria-label="Logout"
        >
          <Image src="/icons/admin-recruiter/logout.svg" alt="Logout" width={32} height={32} />
        </button>
      </div>

      <div className="ml-20 h-full w-[264px] flex flex-col">
        <div className="px-5 pt-10 pb-5">
          <p className="text-xs font-semibold leading-[18px] uppercase tracking-normal text-[#587573]">
            {branding.companyName}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="w-56 rounded-xl bg-transparent">
            <div className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[var(--brand-secondary)]">
              <span className="flex items-center gap-2">
                <Image src="/icons/admin-recruiter/Member.svg" alt="" width={18} height={18} className="shrink-0" />
                Candidates
              </span>
            </div>
            <div className="mt-1 space-y-0">
              {CANDIDATE_SUB.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => handleNavClick(`Candidates/${item.label}`, item.href)}
                    className={`box-border flex h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      active ? "text-[#0f514e]" : "text-[#3e5d5a] hover:bg-[#f2f8f7]"
                    }`}
                    style={
                      active
                        ? {
                            borderColor: "var(--brand-primary)",
                            borderWidth: "1px",
                            backgroundColor: "color-mix(in srgb, var(--brand-accent) 16%, white)",
                          }
                        : undefined
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 w-56 border-t border-[#d6e2df] pt-6">
            <div className="flex w-full items-center justify-between px-2 py-2 text-sm font-semibold text-[var(--brand-secondary)]">
              <span className="flex items-center gap-2">
                <Image src="/icons/admin-recruiter/Member.svg" alt="" width={18} height={18} className="shrink-0" />
                Workers
              </span>
            </div>
            <div className="mt-1 flex h-[128px] w-56 flex-col gap-3">
              {WORKER_SUB.map((item) => {
                const onWorkers = pathname.startsWith("/admin_recruiter/workers");
                const active = onWorkers && item.label === "Active";
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => handleNavClick(`Workers/${item.label}`, item.href)}
                    className={`box-border flex h-8 w-full items-center rounded-md px-2 py-1.5 text-xs transition ${
                      active ? "text-[#0f514e]" : "text-[#3e5d5a] hover:bg-[#f2f8f7]"
                    }`}
                    style={
                      active
                        ? {
                            borderColor: "var(--brand-primary)",
                            borderWidth: "1px",
                            backgroundColor: "color-mix(in srgb, var(--brand-accent) 16%, white)",
                          }
                        : undefined
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6 w-56 border-t border-[#d6e2df] pt-4 space-y-1">
            {[
              { label: "Calendar", href: "/admin_recruiter/calendar", active: inCalendar },
              { label: "Jobs / Assignments", href: "/admin_recruiter/jobs", active: inJobs },
              { label: "Messages", href: "/admin_recruiter/messages", active: inMessages },
              { label: "Notifications", href: "/admin_recruiter/notifications", active: inNotifications },
              {
                label: "Email Templates",
                href: "/admin_recruiter/email-templates",
                active: inEmailTemplates,
              },
              { label: "Settings", href: "/admin_recruiter/settings", active: inSettings },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.label, item.href)}
                className={`box-border flex h-8 w-full items-center rounded-md px-2 py-1.5 text-xs transition ${
                  item.active ? "text-[#0f514e]" : "text-[#3e5d5a] hover:bg-[#f2f8f7]"
                }`}
                style={
                  item.active
                    ? {
                        borderColor: "var(--brand-primary)",
                        borderWidth: "1px",
                        backgroundColor: "color-mix(in srgb, var(--brand-accent) 16%, white)",
                      }
                    : undefined
                }
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="box-border flex h-8 w-full items-center rounded-md px-2 py-1.5 text-xs text-[#3e5d5a] transition hover:bg-[#f2f8f7]"
            >
              Logout
            </button>
          </div>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[344px] max-w-[344px] min-w-[80px] border-r border-[#d7e4e1] lg:block"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 22%, #e9f2f0)" }}
      >
        <SidebarContent />
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity lg:hidden ${
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
        aria-hidden={!isMobileOpen}
      >
        <aside
          className={`h-full w-[344px] max-w-[90vw] min-w-[80px] border-r border-[#d7e4e1] transition-transform ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 22%, #e9f2f0)" }}
          onClick={(event) => event.stopPropagation()}
        >
          <SidebarContent />
        </aside>
      </div>
    </>
  );
}
