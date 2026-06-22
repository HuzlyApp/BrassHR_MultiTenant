"use client";

/* eslint-disable react-hooks/static-components */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { SidebarSubmenuToggleIcon } from "@/app/components/sidebar/SidebarSubmenuToggleIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import {
  CLIENT_SIDEBAR_SECTIONS,
  GOD_ADMIN_SIDEBAR_SECTIONS,
  SIDEBAR_ICON_TYPES,
  type SidebarLink,
  type SidebarSection,
} from "@/app/admin_recruiter/components/sidebar-config";
import SidebarNavIcon from "@/app/admin_recruiter/components/SidebarNavIcon";
import {
  formatRoleLabel,
  getAccountDisplayName,
  getOrganizationDisplayName,
} from "@/lib/account/display-name";
import { supabaseBrowser } from "@/lib/supabase-browser";

const SIDEBAR_EXPANDED_WIDTH = 272;
const SIDEBAR_COLLAPSED_WIDTH = 80;

type AdminRecruiterSidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
};

const DEFAULT_TENANT_LOGO = "/images/new-logo-nexus.svg";

export function AdminRecruiterSidebar({
  isMobileOpen = false,
  onMobileClose,
  collapsed = false,
}: AdminRecruiterSidebarProps) {
  const branding = useTenantBranding();
  const { user, profile, organization } = useAccountData();
  const [logoSrc, setLogoSrc] = useState(branding.logoUrl || DEFAULT_TENANT_LOGO);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [openSectionLabels, setOpenSectionLabels] = useState<string[]>([]);
  const [isGodAdmin, setIsGodAdmin] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const scrollStopTimerRef = useRef<number | null>(null);

  const sidebarSections = isGodAdmin ? GOD_ADMIN_SIDEBAR_SECTIONS : CLIENT_SIDEBAR_SECTIONS;

  const handleNavClick = () => {
    onMobileClose?.();
  };

  useEffect(() => {
    setLogoSrc(branding.logoUrl?.trim() || DEFAULT_TENANT_LOGO);
  }, [branding.logoUrl]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const res = await fetch("/api/admin/effective-branding", {
        cache: "no-store",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as {
        viewer?: { godAdmin?: boolean };
      };
      if (alive) setIsGodAdmin(payload.viewer?.godAdmin === true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabaseBrowser.auth.signOut();
    if (error) return;
    onMobileClose?.();
    router.push("/login");
  };

  const profileName = getAccountDisplayName(profile, user);
  const profileRole = formatRoleLabel(profile?.role);
  const sidebarCompanyName = getOrganizationDisplayName(organization, profile, user);
  const profilePhoto = profile?.avatar_url ?? null;

  const isLinkActive = (link: Pick<SidebarLink, "matchPrefixes" | "matchExact">) =>
    link.matchPrefixes.some((prefix) =>
      link.matchExact ? pathname === prefix || pathname === `${prefix}/` : pathname.startsWith(prefix)
    );

  const isPathActive = (prefixes: string[]) => prefixes.some((prefix) => pathname.startsWith(prefix));

  const isParentHrefActive = (href: string) => {
    if (!href || href === "#") return false;
    return pathname === href || pathname === `${href}/`;
  };

  const renderedSections = useMemo(
    () =>
      sidebarSections.map((section) => {
        const childActive = section.children?.some((child) => isLinkActive(child)) ?? false;
        const sectionPathActive = isPathActive(section.matchPrefixes);
        const sectionActive =
          section.controlsActiveState === false ? false : sectionPathActive || childActive;
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
    [pathname, sidebarSections]
  );

  useEffect(() => {
    const activeParents = sidebarSections
      .filter(
        (section) =>
          isPathActive(section.matchPrefixes) ||
          section.children?.some((child) => isLinkActive(child))
      )
      .map((section) => section.label);
    if (activeParents.length === 0) return;
    setOpenSectionLabels((prev) => Array.from(new Set([...prev, ...activeParents])));
  }, [pathname, sidebarSections]);

  const isSectionOpen = (section: SidebarSection) => openSectionLabels.includes(section.label);

  const toggleSectionOpen = (sectionLabel: string, nav: HTMLElement | null) => {
    const scrollTop = nav?.scrollTop ?? 0;
    setOpenSectionLabels((prev) =>
      prev.includes(sectionLabel) ? prev.filter((label) => label !== sectionLabel) : [...prev, sectionLabel]
    );
    requestAnimationFrame(() => {
      if (nav) nav.scrollTop = scrollTop;
    });
  };

  const handleSectionToggleClick = (
    sectionLabel: string,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    const nav = event.currentTarget.closest("nav");
    toggleSectionOpen(sectionLabel, nav);
  };

  const handleNavScroll = () => {
    const nav = navRef.current;
    if (!nav) return;
    nav.classList.add("is-scrolling");
    if (scrollStopTimerRef.current) window.clearTimeout(scrollStopTimerRef.current);
    scrollStopTimerRef.current = window.setTimeout(() => {
      nav.classList.remove("is-scrolling");
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (scrollStopTimerRef.current) window.clearTimeout(scrollStopTimerRef.current);
    };
  }, []);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const renderSidebarContent = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col overflow-hidden bg-white">
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
              <p className="truncate text-[18px] leading-[28px] font-semibold text-[#0F3B76]">
                {sidebarCompanyName || branding.companyName}
              </p>
              <p className="text-[10px] leading-[15px] font-light uppercase tracking-normal text-[#94A3B8]">
                Dashboard
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <nav
        ref={navRef}
        onScroll={handleNavScroll}
        className={`admin-recruiter-sidebar-nav flex-1 overflow-y-auto overflow-x-hidden ${
          isCollapsed ? "px-2 py-3" : "px-3 py-3"
        }`}
      >
        {renderedSections.map((section) => (
          <div key={section.label} className="mb-1">
            {section.children?.length && !isCollapsed ? (
              <div
                className={`group relative flex min-h-[36px] w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 transition hover:bg-white ${
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
                    <SidebarNavIcon
                      iconType={section.iconType}
                      active={!section.disabled && section.active}
                    />
                    <span className="truncate font-normal text-[14px] leading-5 tracking-normal transition-colors">
                      {section.label}
                    </span>
                  </div>
                ) : (
                  <Link href={section.href} onClick={handleNavClick} className="flex min-w-0 flex-1 items-center gap-3">
                    <SidebarNavIcon
                      iconType={section.iconType}
                      active={!section.disabled && section.active}
                    />
                    <span className="truncate font-normal text-[14px] leading-5 tracking-normal transition-colors">
                      {section.label}
                    </span>
                  </Link>
                )}
                <button
                  type="button"
                  title={`${isSectionOpen(section) ? "Collapse" : "Expand"} ${section.label}`}
                  onClick={(event) => handleSectionToggleClick(section.label, event)}
                  onMouseDown={(event) => event.preventDefault()}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white/70"
                  aria-label={`${isSectionOpen(section) ? "Collapse" : "Expand"} ${section.label}`}
                >
                  <SidebarSubmenuToggleIcon open={isSectionOpen(section)} />
                </button>
                {section.showIndicator ? (
                  <span
                    aria-hidden
                    className="absolute right-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: "var(--brand-secondary)" }}
                  />
                ) : null}
              </div>
            ) : section.disabled ? (
              <div
                title={`${section.label} (Coming soon)`}
                className={`group relative flex min-h-[36px] items-center overflow-hidden rounded-md ${
                  isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2 py-1"
                } text-[#012352]`}
                aria-disabled
              >
                <SidebarNavIcon
                  iconType={section.iconType}
                  active={!section.disabled && section.active}
                />
                {!isCollapsed ? (
                  <span className="font-normal text-[14px] leading-5 tracking-normal transition-colors">{section.label}</span>
                ) : null}
              </div>
            ) : (
              <Link
                href={section.href}
                onClick={handleNavClick}
                title={isCollapsed ? section.label : undefined}
                className={`group relative flex min-h-[36px] items-center overflow-hidden rounded-md transition hover:bg-white ${
                  isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2 py-1"
                } ${
                  section.active
                    ? "text-[color:var(--brand-primary)]"
                    : "text-[#012352] hover:text-[color:var(--brand-primary)]"
                }`}
              >
                <SidebarNavIcon
                  iconType={section.iconType}
                  active={!section.disabled && section.active}
                />
                {!isCollapsed ? (
                  <span className="font-normal text-[14px] leading-5 tracking-normal transition-colors">
                    {section.label}
                  </span>
                ) : null}
                {section.showIndicator || (isCollapsed && section.childActive) ? (
                  <span
                    aria-hidden
                    className="absolute right-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: "var(--brand-secondary)" }}
                  />
                ) : null}
              </Link>
            )}

            {!isCollapsed && section.children?.length && isSectionOpen(section) ? (
              <div className="admin-recruiter-sidebar-submenu space-y-0.5">
                {section.children.map((child) =>
                  child.disabled ? (
                    <div
                      key={`${section.label}-${child.label}`}
                      className="admin-recruiter-sidebar-submenu-item group relative block overflow-hidden rounded-md font-normal text-[14px] leading-5 tracking-normal text-[#012352]"
                      aria-disabled
                    >
                      <span>{child.label}</span>
                    </div>
                  ) : (
                    <Link
                      key={`${section.label}-${child.label}`}
                      href={child.href}
                      onClick={handleNavClick}
                      className={`admin-recruiter-sidebar-submenu-item group relative block overflow-hidden rounded-md font-normal text-[14px] leading-5 tracking-normal transition ${
                        child.active
                          ? "text-[color:var(--brand-primary)]"
                          : "text-[#012352] hover:text-[color:var(--brand-primary)]"
                      }`}
                    >
                      <span>{child.label}</span>
                      {child.active ? (
                        <span
                          aria-hidden
                          className="absolute right-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full"
                          style={{ backgroundColor: "var(--brand-secondary)" }}
                        />
                      ) : null}
                    </Link>
                  )
                )}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className={`border-t border-[#E2E8F0] ${isCollapsed ? "px-2 py-3" : "px-4 py-3"}`}>
        <div className={`flex items-center ${isCollapsed ? "flex-col gap-2" : "gap-2.5"}`}>
          {!isCollapsed ? (
            profilePhoto ? (
              <img
                src={profilePhoto}
                alt={profileName}
                className="h-[30px] w-[30px] shrink-0 rounded-full object-cover"
                width={30}
                height={30}
              />
            ) : (
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[11px] font-semibold text-[#64748B]"
                aria-hidden
              >
                {profileName.charAt(0).toUpperCase()}
              </span>
            )
          ) : null}
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
            <SidebarNavIcon iconType={SIDEBAR_ICON_TYPES.logout} active={false} />
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
        className="admin-recruiter-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[#E2E8F0] bg-white transition-[width] duration-200 ease-in-out lg:block"
        style={asideStyle}
        data-collapsed={collapsed ? "true" : "false"}
      >
        {renderSidebarContent(collapsed)}
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity lg:hidden ${
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
        aria-hidden={!isMobileOpen}
      >
        <aside
          className={`h-full border-r border-[#E2E8F0] bg-white transition-transform ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            width: SIDEBAR_EXPANDED_WIDTH,
            maxWidth: "min(90vw, 272px)",
            boxShadow: "inset 3px 0 0 var(--brand-primary)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {renderSidebarContent(false)}
        </aside>
      </div>
    </>
  );
}

export { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH };
