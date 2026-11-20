"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
  type SettingsNavGroup,
  type SettingsNavItem,
} from "@/app/admin_recruiter/settings/settings-nav";
import { useStaffModuleAccess } from "@/lib/admin/hooks/use-staff-module-access";

const NARROW_MAX_PX = 799;

function NavItemLink({
  item,
  active,
  onNavigate,
  collapsed,
}: {
  item: SettingsNavItem;
  active: boolean;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex w-full items-center overflow-hidden rounded px-2 py-1.5 text-xs leading-4 transition-colors ${
        collapsed ? "justify-center gap-0" : "gap-1.5"
      } ${
        active
          ? "border border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)]"
          : "border border-transparent text-[#012352] hover:bg-[#F8FAFC]"
      }`}
    >
      <Icon
        className="size-5 shrink-0"
        strokeWidth={1.5}
        aria-hidden
        style={{ color: "var(--brand-primary)" }}
      />
      {!collapsed ? <span className="truncate font-normal">{item.label}</span> : null}
      {collapsed ? <span className="sr-only">{item.label}</span> : null}
    </Link>
  );
}

function itemVisible(item: SettingsNavItem, viewKeys: ReadonlySet<string>, godAdmin: boolean): boolean {
  if (godAdmin || viewKeys.has("*")) return true;
  return viewKeys.has(item.resourceKey);
}

function visibleSettingsNavGroups(
  groups: SettingsNavGroup[],
  viewKeys: ReadonlySet<string>,
  godAdmin: boolean
): SettingsNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => itemVisible(item, viewKeys, godAdmin)),
    }))
    .filter((group) => group.items.length > 0);
}

export default function SettingsSidebar() {
  const pathname = usePathname() ?? "";
  const { viewKeySet, godAdmin, loading } = useStaffModuleAccess();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [expandedOnNarrow, setExpandedOnNarrow] = useState(false);

  const groups = useMemo(
    () => visibleSettingsNavGroups(SETTINGS_NAV_GROUPS, viewKeySet, godAdmin),
    [viewKeySet, godAdmin]
  );

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(`(max-width: ${NARROW_MAX_PX}px)`);
    const sync = () => {
      const narrow = media.matches;
      setIsNarrow(narrow);
      if (!narrow) setExpandedOnNarrow(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const collapsed = isNarrow && !expandedOnNarrow;

  return (
    <aside
      aria-label="Settings sections"
      data-collapsed={collapsed ? "true" : "false"}
      className={`z-10 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-x border-[#E5E7EB] bg-white transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-14 px-1.5 py-3" : "w-[195px] px-3.5 py-5"
      }`}
    >
      {isNarrow ? (
        <div className={`mb-2 flex ${collapsed ? "justify-center" : "justify-end"}`}>
          <button
            type="button"
            onClick={() => setExpandedOnNarrow((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#012352]"
            aria-label={collapsed ? "Expand settings menu" : "Collapse settings menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      ) : null}
      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain">
        {loading && groups.length === 0 ? (
          <p className={`text-xs text-[#6B7280] ${collapsed ? "px-0 text-center" : "px-2"}`}>
            {collapsed ? "…" : "Loading…"}
          </p>
        ) : null}
        {groups.map((group, groupIndex) => (
          <div key={group.id} className="flex flex-col gap-3">
            {groupIndex > 0 ? <div className="h-px w-full bg-[#E5E7EB]" role="separator" /> : null}
            <div className="flex flex-col gap-3">
              {group.label && !collapsed ? (
                <p className="text-xs font-semibold uppercase leading-[18px] text-[#4B5563]">
                  {group.label}
                </p>
              ) : null}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = pendingHref
                    ? item.href === pendingHref
                    : isSettingsNavItemActive(item, pathname);
                  return (
                    <NavItemLink
                      key={item.id}
                      item={item}
                      active={active}
                      collapsed={collapsed}
                      onNavigate={() => setPendingHref(item.href)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
