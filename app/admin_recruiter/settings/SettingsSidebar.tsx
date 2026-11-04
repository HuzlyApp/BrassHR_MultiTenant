"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
  type SettingsNavGroup,
  type SettingsNavItem,
} from "@/app/admin_recruiter/settings/settings-nav";
import { useStaffModuleAccess } from "@/lib/admin/hooks/use-staff-module-access";

function NavItemLink({
  item,
  active,
  onNavigate,
}: {
  item: SettingsNavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-1.5 overflow-hidden rounded px-2 py-1.5 text-xs leading-4 transition-colors ${
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
      <span className="font-normal">{item.label}</span>
    </Link>
  );
}

function itemVisible(item: SettingsNavItem, viewKeys: ReadonlySet<string>, godAdmin: boolean): boolean {
  if (godAdmin || viewKeys.has("*")) return true;
  // Help & Support + Reports are Settings-only and shown for every staff role.
  if (item.resourceKey === "settings_help" || item.resourceKey === "settings_reports") {
    return true;
  }
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

  const groups = useMemo(
    () => visibleSettingsNavGroups(SETTINGS_NAV_GROUPS, viewKeySet, godAdmin),
    [viewKeySet, godAdmin]
  );

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside
      aria-label="Settings sections"
      className="z-10 hidden h-full min-h-0 w-[195px] shrink-0 overflow-y-auto overscroll-y-contain border-x border-[#E5E7EB] bg-white px-3.5 py-5 md:block"
    >
      <nav className="flex flex-col gap-3">
        {loading && groups.length === 0 ? (
          <p className="px-2 text-xs text-[#6B7280]">Loading…</p>
        ) : null}
        {groups.map((group, groupIndex) => (
          <div key={group.id} className="flex flex-col gap-3">
            {groupIndex > 0 ? <div className="h-px w-full bg-[#E5E7EB]" role="separator" /> : null}
            <div className="flex flex-col gap-3">
              {group.label ? (
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
