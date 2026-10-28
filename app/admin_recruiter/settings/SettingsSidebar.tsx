"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
  type SettingsNavGroup,
  type SettingsNavItem,
} from "@/app/admin_recruiter/settings/settings-nav";
import { useStaffModuleAccess } from "@/lib/admin/hooks/use-staff-module-access";

/** Map settings nav ids to MultiTenant permission resource keys. */
const NAV_ITEM_RESOURCE_KEY: Partial<Record<SettingsNavItem["id"], string>> = {
  profile: "settings_profile",
  account: "settings_profile",
  branding: "settings_company",
  notifications: "settings_notifications",
  security: "settings_company",
  automation: "settings_automation",
  profession: "settings_company",
  assessment: "settings_company",
  statuses: "settings_company",
  templates: "settings_company",
  "admin-console": "settings_company",
  roles: "settings_company",
  help: "settings_help",
  reports: "settings_reports",
};

function NavItemLink({ item, active }: { item: SettingsNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
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
  const resourceKey = NAV_ITEM_RESOURCE_KEY[item.id];
  if (!resourceKey) return true;
  return viewKeys.has(resourceKey);
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

  const groups = useMemo(
    () => visibleSettingsNavGroups(SETTINGS_NAV_GROUPS, viewKeySet, godAdmin),
    [viewKeySet, godAdmin]
  );

  return (
    <aside
      aria-label="Settings sections"
      className="sticky top-0 z-10 hidden h-[100dvh] w-[195px] shrink-0 self-start overflow-y-auto border-x border-[#E5E7EB] bg-white px-3.5 py-5 lg:block"
    >
      <nav className="flex flex-col gap-3">
        {loading && groups.length === 0 ? (
          <p className="px-2 text-xs text-[#6B7280]">Loading?</p>
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
                {group.items.map((item) => (
                  <NavItemLink
                    key={item.id}
                    item={item}
                    active={isSettingsNavItemActive(item, pathname)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
