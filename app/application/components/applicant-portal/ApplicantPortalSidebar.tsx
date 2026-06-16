"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import SidebarNavIcon from "@/app/admin_recruiter/components/SidebarNavIcon";
import {
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
  WORKER_SIDEBAR_ICON_TYPES,
  WORKER_SIDEBAR_SECTIONS,
  type WorkerSidebarSection,
} from "@/app/application/components/applicant-portal/worker-sidebar-config";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { isRemoteOrBlobImageSrc, normalizeBrandingImageSrc } from "@/lib/tenant/tenant-branding";
import { supabaseBrowser } from "@/lib/supabase-browser";

const DEFAULT_LOGO = "/images/new-logo-nexus.svg";

type Props = {
  applicantName: string;
  mobileOpen?: boolean;
  collapsed?: boolean;
  onMobileClose?: () => void;
  onOpenMessages?: () => void;
};

export function ApplicantPortalSidebar({
  applicantName,
  mobileOpen = false,
  collapsed = false,
  onMobileClose,
  onOpenMessages,
}: Props) {
  const branding = useTenantBranding();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [logoSrc, setLogoSrc] = useState(
    normalizeBrandingImageSrc(branding.logoUrl, DEFAULT_LOGO, { allowBlob: true })
  );
  const [openSectionLabels, setOpenSectionLabels] = useState<string[]>([]);

  const firstName = applicantName.split(" ")[0] || "Applicant";
  const initial = firstName.charAt(0).toUpperCase();
  const logoUseNativeImg = isRemoteOrBlobImageSrc(logoSrc);

  useEffect(() => {
    setLogoSrc(normalizeBrandingImageSrc(branding.logoUrl, DEFAULT_LOGO, { allowBlob: true }));
  }, [branding.logoUrl]);

  const handleNavClick = () => {
    onMobileClose?.();
  };

  const isPathActive = (prefixes: string[]) =>
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const renderedSections = useMemo(
    () =>
      WORKER_SIDEBAR_SECTIONS.map((section) => {
        const childActive = section.children?.some((child) => isPathActive(child.matchPrefixes)) ?? false;
        return {
          ...section,
          active: childActive ? false : isPathActive(section.matchPrefixes),
          children:
            section.children?.map((child) => ({
              ...child,
              active: isPathActive(child.matchPrefixes),
            })) ?? [],
        };
      }),
    [pathname]
  );

  useEffect(() => {
    const activeParents = WORKER_SIDEBAR_SECTIONS.filter(
      (section) =>
        isPathActive(section.matchPrefixes) ||
        section.children?.some((child) => isPathActive(child.matchPrefixes))
    ).map((section) => section.label);
    if (activeParents.length === 0) return;
    setOpenSectionLabels((prev) => Array.from(new Set([...prev, ...activeParents])));
  }, [pathname]);

  const isSectionOpen = (section: WorkerSidebarSection) => openSectionLabels.includes(section.label);

  const toggleSectionOpen = (sectionLabel: string) => {
    setOpenSectionLabels((prev) =>
      prev.includes(sectionLabel) ? prev.filter((label) => label !== sectionLabel) : [...prev, sectionLabel]
    );
  };

  const sidebarWidth = collapsed ? WORKER_SIDEBAR_COLLAPSED_WIDTH : WORKER_SIDEBAR_EXPANDED_WIDTH;

  const SidebarContent = ({
    isCollapsed,
    isMobileRail = false,
    showMobileClose,
  }: {
    isCollapsed: boolean;
    isMobileRail?: boolean;
    showMobileClose?: boolean;
  }) => (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div
        className={`border-b border-[#E2E8F0] ${
          isMobileRail
            ? "flex h-16 shrink-0 items-center justify-center px-1"
            : isCollapsed
              ? "px-2 py-3"
              : "px-4 py-3"
        }`}
      >
        <div
          className={`flex w-full items-center ${isCollapsed && !isMobileRail ? "justify-center" : showMobileClose ? "justify-between gap-3" : isMobileRail ? "justify-center" : "gap-3"}`}
        >
          <div className={`flex min-w-0 items-center ${isCollapsed && !isMobileRail ? "" : isMobileRail ? "justify-center" : "gap-3"}`}>
            <div
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white ${
                isMobileRail ? "h-9 w-9" : "h-10 w-10"
              }`}
              style={{ borderColor: "color-mix(in srgb, var(--brand-primary) 55%, #CBD5E1)" }}
            >
              {logoUseNativeImg ? (
                <img
                  src={logoSrc}
                  alt={branding.companyName}
                  className={`object-contain ${isMobileRail ? "max-h-[32px] max-w-[32px]" : "max-h-[40px] max-w-[40px]"}`}
                  onError={() => setLogoSrc(DEFAULT_LOGO)}
                />
              ) : (
                <Image
                  src={logoSrc}
                  alt={branding.companyName}
                  width={40}
                  height={40}
                  className={`object-contain ${isMobileRail ? "max-h-[32px] max-w-[32px]" : "max-h-[40px] max-w-[40px]"}`}
                  onError={() => setLogoSrc(DEFAULT_LOGO)}
                />
              )}
            </div>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold leading-7 text-[#0F3B76]">{firstName}</p>
                <p className="text-[10px] font-light uppercase leading-[15px] tracking-normal text-[#94A3B8]">
                  Dashboard
                </p>
              </div>
            ) : null}
          </div>
          {showMobileClose ? (
            <button
              type="button"
              onClick={onMobileClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white hover:text-[#0F3B76]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden ${
          isMobileRail ? "px-1 py-2" : isCollapsed ? "px-2 py-3" : "px-3 py-3"
        }`}
      >
        {renderedSections.map((section) => (
          <div key={section.label} className="mb-1">
            {section.children?.length && !isCollapsed ? (
              <div
                className={`group relative flex min-h-[36px] w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 transition hover:bg-white ${
                  section.disabled ? "opacity-60" : ""
                } ${
                  section.active
                    ? "text-[color:var(--brand-primary)]"
                    : "text-[#012352] hover:text-[color:var(--brand-primary)]"
                }`}
              >
                {section.disabled || section.href === "#" ? (
                  <div
                    title={section.disabled ? `${section.label} (Coming soon)` : section.label}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <SidebarNavIcon iconType={section.iconType} active={!section.disabled && section.active} />
                    <span className="truncate text-[14px] font-normal leading-5">{section.label}</span>
                  </div>
                ) : (
                  <Link href={section.href} onClick={handleNavClick} className="flex min-w-0 flex-1 items-center gap-3">
                    <SidebarNavIcon iconType={section.iconType} active={section.active} />
                    <span className="truncate text-[14px] font-normal leading-5">{section.label}</span>
                  </Link>
                )}
                <button
                  type="button"
                  title={`${isSectionOpen(section) ? "Collapse" : "Expand"} ${section.label}`}
                  onClick={() => toggleSectionOpen(section.label)}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white/70"
                  aria-label={`${isSectionOpen(section) ? "Collapse" : "Expand"} ${section.label}`}
                >
                  {isSectionOpen(section) ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {section.active && !section.disabled ? (
                  <span
                    aria-hidden
                    className="absolute right-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: "var(--brand-secondary)" }}
                  />
                ) : null}
              </div>
            ) : section.action === "messages" ? (
              <button
                type="button"
                onClick={() => {
                  onOpenMessages?.();
                  handleNavClick();
                }}
                className={`group relative flex min-h-[36px] w-full items-center overflow-hidden rounded-md transition hover:bg-white ${
                  isCollapsed ? (isMobileRail ? "justify-center px-1 py-1.5" : "justify-center px-2 py-2") : "gap-3 px-2 py-1"
                } text-[#012352] hover:text-[color:var(--brand-primary)]`}
              >
                <SidebarNavIcon iconType={section.iconType} active={false} />
                {!isCollapsed ? (
                  <span className="text-[14px] font-normal leading-5">{section.label}</span>
                ) : null}
              </button>
            ) : section.disabled ? (
              <div
                title={`${section.label} (Coming soon)`}
                className={`group relative flex min-h-[36px] items-center overflow-hidden rounded-md opacity-60 ${
                  isCollapsed ? (isMobileRail ? "justify-center px-1 py-1.5" : "justify-center px-2 py-2") : "gap-3 px-2 py-1"
                } text-[#012352]`}
                aria-disabled
              >
                <SidebarNavIcon iconType={section.iconType} active={false} />
                {!isCollapsed ? (
                  <span className="text-[14px] font-normal leading-5">{section.label}</span>
                ) : null}
              </div>
            ) : (
              <Link
                href={section.href}
                onClick={handleNavClick}
                title={isCollapsed ? section.label : undefined}
                className={`group relative flex min-h-[36px] items-center overflow-hidden rounded-md transition hover:bg-white ${
                  isCollapsed ? (isMobileRail ? "justify-center px-1 py-1.5" : "justify-center px-2 py-2") : "gap-3 px-2 py-1"
                } ${
                  section.active
                    ? "text-[color:var(--brand-primary)]"
                    : "text-[#012352] hover:text-[color:var(--brand-primary)]"
                }`}
              >
                <SidebarNavIcon iconType={section.iconType} active={section.active} />
                {!isCollapsed ? (
                  <span className="text-[14px] font-normal leading-5">{section.label}</span>
                ) : null}
                {section.active ? (
                  <span
                    aria-hidden
                    className="absolute right-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: "var(--brand-secondary)" }}
                  />
                ) : null}
              </Link>
            )}

            {!isCollapsed && section.children?.length && isSectionOpen(section) ? (
              <div className="ml-7 mt-0.5 space-y-0.5">
                {section.children.map((child) => (
                  <div
                    key={`${section.label}-${child.label}`}
                    className={`rounded-md px-2 py-1.5 text-[14px] font-normal leading-5 text-[#012352] ${
                      child.disabled ? "opacity-60" : ""
                    }`}
                    aria-disabled={child.disabled}
                  >
                    {child.label}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div
        className={`border-t border-[#E2E8F0] ${
          isMobileRail ? "px-1 py-2" : isCollapsed ? "px-2 py-3" : "px-4 py-3"
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? "flex-col gap-2" : "gap-2.5"}`}>
          {!isCollapsed ? (
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              aria-hidden
            >
              {initial}
            </span>
          ) : null}
          {!isCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-5 text-[#0F2F60]">{firstName}.</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              router.replace("/");
            }}
            title="Sign out"
            className={`rounded-md p-1 hover:bg-white/80 ${isCollapsed ? "" : "ml-auto"}`}
          >
            <SidebarNavIcon iconType={WORKER_SIDEBAR_ICON_TYPES.logout} active={false} />
          </button>
        </div>
      </div>
    </div>
  );

  const asideStyle = {
    width: sidebarWidth,
    maxWidth: sidebarWidth,
    minWidth: WORKER_SIDEBAR_COLLAPSED_WIDTH,
    boxShadow: "inset 3px 0 0 var(--brand-primary)",
  };

  return (
    <>
      <aside
        className="applicant-portal-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen overflow-hidden border-r border-[#E2E8F0] bg-white min-[1000px]:block"
        style={asideStyle}
        data-collapsed={collapsed ? "true" : "false"}
      >
        <SidebarContent isCollapsed={collapsed} />
      </aside>

      <aside
        className={`applicant-portal-sidebar applicant-portal-sidebar-mobile-rail fixed inset-y-0 left-0 z-40 h-screen overflow-hidden border-r border-[#E2E8F0] bg-white min-[1000px]:hidden ${
          mobileOpen ? "hidden" : "block"
        }`}
        data-collapsed="true"
      >
        <SidebarContent isCollapsed isMobileRail />
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity min-[1000px]:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      >
        <aside
          className={`h-full border-r border-[#E2E8F0] bg-white transition-transform duration-200 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            width: WORKER_SIDEBAR_EXPANDED_WIDTH,
            maxWidth: "min(90vw, 344px)",
            boxShadow: "inset 3px 0 0 var(--brand-primary)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <SidebarContent isCollapsed={false} showMobileClose />
        </aside>
      </div>
    </>
  );
}

export {
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
};
