"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SETTINGS_NAV_GROUPS,
  isSettingsNavItemActive,
  type SettingsNavIcon,
} from "@/app/admin_recruiter/settings/settings-nav";

function SettingsNavGlyph({ icon }: { icon: SettingsNavIcon }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center">
      <img src={icon.src} alt="" width={icon.width} height={icon.height} />
    </span>
  );
}

function SettingsDivider() {
  return (
    <div className="relative h-2 w-full overflow-hidden" aria-hidden>
      <img src="/icons/settings-nav/divider.svg" alt="" width={378.667} height={8} />
    </div>
  );
}

export function SettingsSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-full shrink-0 border-y border-[#E5E7EB] bg-white px-3.5 py-5 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-[220px] lg:overflow-y-auto lg:border-x lg:border-y-0">
      <nav className="flex flex-col gap-3" aria-label="Settings">
        {SETTINGS_NAV_GROUPS.map((group, index) => (
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
