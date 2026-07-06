"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { SidebarSubmenuToggleIcon } from "@/app/components/sidebar/SidebarSubmenuToggleIcon";
import SidebarNavIcon from "@/app/admin_recruiter/components/SidebarNavIcon";
import {
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
  WORKER_SIDEBAR_ICON_TYPES,
  WORKER_SIDEBAR_SECTIONS,
  type WorkerSidebarLink,
  type WorkerSidebarSection,
} from "@/app/application/components/applicant-portal/worker-sidebar-config";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { withTenant } from "@/lib/tenant/with-tenant";
import { isRemoteOrBlobImageSrc, normalizeBrandingImageSrc } from "@/lib/tenant/tenant-branding";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerPortalUserAvatar } from "./WorkerPortalUserAvatar";
import {
  SIDEBAR_NAV_ACTIVE_TEXT_CLASS,
  SIDEBAR_NAV_INACTIVE_TEXT_CLASS,
  sidebarNavTextClass,
  sidebarSubmenuTextClass,
} from "@/lib/sidebar/sidebar-nav-styles";

const DEFAULT_LOGO = "/images/new-logo-nexus.svg";

function parentWithSubmenuRowClass(active: boolean, disabled = false): string {
  const base =
    "group relative flex min-h-[36px] w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md border-0 bg-transparent pl-2 pr-0 py-1 text-left";
  const color = sidebarNavTextClass(active);
  return disabled ? `${base} ${color} opacity-60` : `${base} ${color} transition hover:bg-white`;
}

function submenuTextClass(active: boolean, disabled = false): string {
  const base =
    "font-normal text-[14px] leading-5 tracking-normal transition-colors";
  return `${base} ${sidebarSubmenuTextClass(active, disabled)}`;
}

function topLevelLabelClass(active: boolean, disabled = false): string {
  const base = "truncate font-normal text-[14px] leading-5 tracking-normal transition-colors";
  if (disabled) return `${base} ${SIDEBAR_NAV_INACTIVE_TEXT_CLASS} opacity-60`;
  return active
    ? `${base} ${SIDEBAR_NAV_ACTIVE_TEXT_CLASS}`
    : `${base} ${SIDEBAR_NAV_INACTIVE_TEXT_CLASS} group-hover:text-[color:var(--brand-primary)]`;
}

function topLevelLinkClass(active: boolean, isCollapsed: boolean, isMobileRail: boolean, disabled = false): string {
  const layout = isCollapsed
    ? isMobileRail
      ? "justify-center pl-1 pr-0 py-1.5"
      : "justify-center pl-2 pr-0 py-2"
    : "gap-3 pl-2 pr-0 py-1";

  if (disabled) {
    return `group relative flex min-h-[36px] items-center overflow-hidden rounded-md opacity-60 ${layout} ${SIDEBAR_NAV_INACTIVE_TEXT_CLASS}`;
  }

  return `group relative flex min-h-[36px] items-center overflow-hidden rounded-md transition hover:bg-white ${layout} ${sidebarNavTextClass(active)}`;
}

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
  const { profilePhotoUrl } = useApplicantPortal();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const tenantQuery = searchParams?.get("tenant");
  const scheduleViewParam = searchParams?.get("view");
  const [logoSrc, setLogoSrc] = useState(
    normalizeBrandingImageSrc(branding.logoUrl, DEFAULT_LOGO, { allowBlob: true })
  );
  const [openSectionLabels, setOpenSectionLabels] = useState<string[]>([]);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const firstName = applicantName.split(" ")[0] || "Applicant";
  const logoUseNativeImg = isRemoteOrBlobImageSrc(logoSrc);

  useEffect(() => {
    setLogoSrc(normalizeBrandingImageSrc(branding.logoUrl, DEFAULT_LOGO, { allowBlob: true }));
  }, [branding.logoUrl]);

  const handleNavClick = () => {
    onMobileClose?.();
  };

  const isLinkActive = (link: WorkerSidebarLink) => {
    const pathMatches = link.matchPrefixes.some((prefix) =>
      link.matchExact
        ? pathname === prefix || pathname === `${prefix}/`
        : pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (!pathMatches) return false;

    if (link.scheduleView === "calendar") {
      return scheduleViewParam === "calendar";
    }
    if (link.scheduleView === "attendance") {
      return scheduleViewParam !== "calendar";
    }

    return true;
  };

  const isSectionPathActive = (section: Pick<WorkerSidebarSection, "matchPrefixes" | "matchExact">) =>
    section.matchPrefixes.some((prefix) =>
      section.matchExact
        ? pathname === prefix || pathname === `${prefix}/`
        : pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  const isParentHrefActive = (href: string) => {
    if (!href || href === "#") return false;
    return pathname === href || pathname === `${href}/`;
  };

  const renderedSections = useMemo(
    () =>
      WORKER_SIDEBAR_SECTIONS.map((section) => {
        const childActive = section.children?.some((child) => isLinkActive(child)) ?? false;
        const sectionPathActive = isSectionPathActive(section);
        const sectionActive = sectionPathActive || childActive;
        const showIndicator = section.children?.length
          ? !childActive && isParentHrefActive(section.href)
          : sectionActive;

        return {
          ...section,
          active: sectionActive,
          showIndicator,
          childActive,
          children:
            section.children?.map((child) => ({
              ...child,
              active: isLinkActive(child),
            })) ?? [],
        };
      }),
    [pathname, scheduleViewParam]
  );

  useEffect(() => {
    const activeParents = WORKER_SIDEBAR_SECTIONS.filter(
      (section) =>
        isSectionPathActive(section) || section.children?.some((child) => isLinkActive(child))
    ).map((section) => section.label);
    if (activeParents.length === 0) return;
    setOpenSectionLabels((prev) => Array.from(new Set([...prev, ...activeParents])));
  }, [pathname, scheduleViewParam]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.ownerDocument.activeElement;
    if (active instanceof HTMLElement && nav.contains(active)) {
      active.blur();
    }
    setSidebarHovered(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) setSidebarHovered(false);
  }, [mobileOpen]);

  const isSectionOpen = (section: WorkerSidebarSection) => openSectionLabels.includes(section.label);

  const toggleSectionOpen = (sectionLabel: string) => {
    setOpenSectionLabels((prev) =>
      prev.includes(sectionLabel) ? prev.filter((label) => label !== sectionLabel) : [...prev, sectionLabel]
    );
  };

  const sidebarHoverProps = {
    onMouseEnter: () => setSidebarHovered(true),
    onMouseLeave: () => setSidebarHovered(false),
  };

  const sidebarHoverClass = sidebarHovered ? "is-hovered" : "";

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
        className={`worker-portal-sidebar-brand shrink-0 ${
          isMobileRail
            ? "justify-center px-1"
            : isCollapsed
              ? "px-2"
              : "px-4"
        }`}
      >
        <div
          className={`flex w-full items-center ${isCollapsed && !isMobileRail ? "justify-center" : showMobileClose ? "justify-between gap-3" : isMobileRail ? "justify-center" : "gap-3"}`}
        >
          <div className={`flex min-w-0 items-center ${isCollapsed && !isMobileRail ? "" : isMobileRail ? "justify-center" : "gap-3"}`}>
            <button
              type="button"
              onClick={() => {
                router.push(applicationPath("/application/home", tenantQuery));
                handleNavClick();
              }}
              aria-label="Go to home"
              className="rounded-xl"
            >
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
            </button>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[18px] leading-[28px] font-semibold text-[color:var(--brand-secondary)]">
                  {firstName}
                </p>
                <p className="text-[10px] leading-[15px] font-light uppercase tracking-normal text-[color:var(--brand-primary)]">
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
        ref={navRef}
        className={`worker-sidebar-nav flex-1 overflow-y-auto overflow-x-hidden ${
          isMobileRail ? "py-2 pl-1 pr-0" : isCollapsed ? "py-3 pl-2 pr-0" : "py-3 pl-3 pr-0"
        }`}
      >
        {renderedSections.map((section) => (
          <div key={section.label} className="mb-1">
            {section.children?.length && !isCollapsed ? (
              <button
                type="button"
                title={section.disabled ? `${section.label} (Coming soon)` : section.label}
                onClick={() => toggleSectionOpen(section.label)}
                onMouseDown={(event) => event.preventDefault()}
                className={parentWithSubmenuRowClass(section.childActive, Boolean(section.disabled))}
                aria-expanded={isSectionOpen(section)}
                aria-label={`${isSectionOpen(section) ? "Collapse" : "Expand"} ${section.label}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <SidebarNavIcon iconType={section.iconType} active={section.childActive} />
                  <span className="truncate font-normal text-[14px] leading-5 tracking-normal">
                    {section.label}
                  </span>
                </div>
                <span
                  className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    section.childActive ? SIDEBAR_NAV_ACTIVE_TEXT_CLASS : SIDEBAR_NAV_INACTIVE_TEXT_CLASS
                  }`}
                  aria-hidden
                >
                  <SidebarSubmenuToggleIcon open={isSectionOpen(section)} />
                </span>
                {section.showIndicator ? (
                  <span aria-hidden className="worker-sidebar-active-indicator" />
                ) : null}
              </button>
            ) : section.children?.length && isCollapsed ? (
              <div
                title={section.label}
                className={`group relative flex min-h-[36px] w-full items-center justify-center overflow-hidden rounded-md py-2 pl-2 pr-0 ${
                  section.childActive ? SIDEBAR_NAV_ACTIVE_TEXT_CLASS : SIDEBAR_NAV_INACTIVE_TEXT_CLASS
                }`}
              >
                <SidebarNavIcon iconType={section.iconType} active={section.childActive} />
                {section.childActive ? (
                  <span aria-hidden className="worker-sidebar-active-indicator" />
                ) : null}
              </div>
            ) : section.action === "messages" ? (
              <button
                type="button"
                onClick={() => {
                  onOpenMessages?.();
                  handleNavClick();
                }}
                className={topLevelLinkClass(section.active, isCollapsed, isMobileRail, false)}
              >
                <SidebarNavIcon iconType={section.iconType} active={section.active && !section.disabled} />
                {!isCollapsed ? (
                  <span className={topLevelLabelClass(section.active, Boolean(section.disabled))}>
                    {section.label}
                  </span>
                ) : null}
              </button>
            ) : section.disabled ? (
              <div
                title={`${section.label} (Coming soon)`}
                className={topLevelLinkClass(false, isCollapsed, isMobileRail, true)}
                aria-disabled
              >
                <SidebarNavIcon iconType={section.iconType} active={false} />
                {!isCollapsed ? (
                  <span className={topLevelLabelClass(false, true)}>{section.label}</span>
                ) : null}
              </div>
            ) : (
              <Link
                href={section.href}
                onClick={handleNavClick}
                title={isCollapsed ? section.label : undefined}
                className={topLevelLinkClass(section.active, isCollapsed, isMobileRail, false)}
              >
                <SidebarNavIcon iconType={section.iconType} active={section.active && !section.disabled} />
                {!isCollapsed ? (
                  <span className={topLevelLabelClass(section.active, false)}>{section.label}</span>
                ) : null}
                {section.showIndicator || (isCollapsed && section.active) ? (
                  <span aria-hidden className="worker-sidebar-active-indicator" />
                ) : null}
              </Link>
            )}

            {!isCollapsed && section.children?.length && isSectionOpen(section) ? (
              <div className="worker-sidebar-submenu space-y-0.5">
                {section.children.map((child) =>
                  child.disabled || !child.href || child.href === "#" ? (
                    <div
                      key={`${section.label}-${child.label}`}
                      className={`worker-sidebar-submenu-item group relative block overflow-hidden rounded-md font-normal text-[14px] leading-5 tracking-normal ${SIDEBAR_NAV_INACTIVE_TEXT_CLASS} opacity-60`}
                      aria-disabled={child.disabled}
                    >
                      <span>{child.label}</span>
                    </div>
                  ) : (
                    <Link
                      key={`${section.label}-${child.label}`}
                      href={child.href}
                      onClick={handleNavClick}
                      className={`worker-sidebar-submenu-item group relative block overflow-hidden rounded-md transition hover:bg-white ${submenuTextClass(
                        child.active,
                        false
                      )}`}
                    >
                      <span>{child.label}</span>
                      {child.active ? (
                        <span aria-hidden className="worker-sidebar-active-indicator" />
                      ) : null}
                    </Link>
                  )
                )}
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
          <WorkerPortalUserAvatar
            name={applicantName}
            photoUrl={profilePhotoUrl}
            size={30}
            className={isCollapsed ? "" : ""}
          />
          {!isCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] leading-5 font-semibold text-[color:var(--brand-secondary)]">{applicantName}</p>
              <p className="truncate text-[10px] leading-[15px] font-light text-[#94A3B8]">Worker</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              const loginHref = withTenant("/worker-signin", tenantQuery ?? branding.slug);
              router.replace(loginHref);
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
        className={`applicant-portal-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen overflow-hidden border-r border-[#E2E8F0] worker-portal-chrome-border-r bg-white min-[1000px]:block ${sidebarHoverClass}`}
        style={asideStyle}
        data-collapsed={collapsed ? "true" : "false"}
        {...sidebarHoverProps}
      >
        <SidebarContent isCollapsed={collapsed} />
      </aside>

      <aside
        className={`applicant-portal-sidebar applicant-portal-sidebar-mobile-rail fixed inset-y-0 left-0 z-40 h-screen overflow-hidden border-r border-[#E2E8F0] worker-portal-chrome-border-r bg-white min-[1000px]:hidden ${sidebarHoverClass} ${
          mobileOpen ? "hidden" : "block"
        }`}
        data-collapsed="true"
        {...sidebarHoverProps}
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
          className={`applicant-portal-sidebar h-full border-r border-[#E2E8F0] worker-portal-chrome-border-r bg-white transition-transform duration-200 ease-in-out ${sidebarHoverClass} ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            width: WORKER_SIDEBAR_EXPANDED_WIDTH,
            maxWidth: "min(90vw, 272px)",
            boxShadow: "inset 3px 0 0 var(--brand-primary)",
          }}
          onClick={(event) => event.stopPropagation()}
          {...sidebarHoverProps}
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
