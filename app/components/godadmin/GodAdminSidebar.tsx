"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "Tenants Console",
    href: "/godadmin/tenants",
    matchPrefixes: ["/godadmin/tenants", "/godadmin"],
  },
] as const;

export default function GodAdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="godadmin-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-[#0f172a] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">God Admin</p>
        <p className="mt-1 text-lg font-semibold text-white">Platform Console</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="God Admin navigation">
        {NAV_ITEMS.map((item) => {
          const active = item.matchPrefixes.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-[#0d9488] text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
        Cross-tenant management
      </div>
    </aside>
  );
}
