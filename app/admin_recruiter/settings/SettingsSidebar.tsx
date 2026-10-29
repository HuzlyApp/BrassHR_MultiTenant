"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
  type SettingsNavGroup,
  type SettingsNavIcon,
  type SettingsNavItem,
} from "@/app/admin_recruiter/settings/settings-nav";
import { useStaffModuleAccess } from "@/lib/admin/hooks/use-staff-module-access";

function SettingsNavGlyph({ icon }: { icon: SettingsNavIcon }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon.src} alt="" width={icon.width} height={icon.height} />
    </span>
  );
}

function SettingsDivider() {
  return (
    <div className="relative h-2 w-full overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/settings-nav/divider.svg" alt="" width={378.667} height={8} />
    </div>
  );
}

function itemVisible(item: SettingsNavItem, viewKeys: ReadonlySet<string>, godAdmin: boolean): boolean {
  if (godAdmin || viewKeys.has("*")) return true;
  if (!item.resourceKey) return true;
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

export function SettingsSidebar() {
  const pathname = usePathname() ?? "";
  const { viewKeySet, godAdmin, loading } = useStaffModuleAccess();

  const groups = useMemo(
    () => visibleSettingsNavGroups(SETTINGS_NAV_GROUPS, viewKeySet, godAdmin),
    [viewKeySet, godAdmin]
  );

  return (
    <aside className="w-full shrink-0 border-y border-[#E5E7EB] bg-white px-3.5 py-5 lg:sticky lg:top-[var(--admin-recruiter-header-height,4rem)] lg:h-[calc(100dvh-var(--admin-recruiter-header-height,4rem))] lg:w-[220px] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:border-x lg:border-y-0">
      <nav className="flex flex-col gap-3" aria-label="Settings">
        {loading && groups.length === 0 ? (
          <p className="px-2 text-xs text-[#6B7280]">Loading…</p>
        ) : null}
        {groups.map((group, index) => (
          <div key={group.label} className="flex flex-col gap-3">
            {index > 0 ? <SettingsDivider /> : null}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase leading-[18px] text-[#4B5563]">{group.label}</p>
              <div className="flex flex-col">
                {group.items.map((item) => {
                  const active = isSettingsNavItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 ${
                        active ? "border border-[#BC8B41] bg-white" : "border border-transparent"
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <SettingsNavGlyph icon={item.icon} />
                        <span
                          className={`text-xs font-normal leading-4 whitespace-nowrap ${
                            active ? "text-[#BC8B41]" : "text-[#012352]"
                          }`}
                        >
                          {item.label}
                        </span>
                      </span>
                    </Link>
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
