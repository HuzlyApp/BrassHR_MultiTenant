"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const NAV_ITEMS = [
  {
    label: "Tenants Console",
    href: "/godadmin/tenants",
    matchPrefixes: ["/godadmin/tenants"],
  },
  {
    label: "Industry Prompts",
    href: "/godadmin/industry-prompts",
    matchPrefixes: ["/godadmin/industry-prompts"],
  },
  {
    label: "Prompt Catalog",
    href: "/godadmin/prompt-catalog",
    matchPrefixes: ["/godadmin/prompt-catalog"],
  },
  {
    label: "Service Area",
    href: "/godadmin/service-area",
    matchPrefixes: ["/godadmin/service-area"],
  },
] as const;

export default function GodAdminSidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabaseBrowser.auth.signOut();
      router.replace("/admin");
    } catch {
      setSigningOut(false);
    }
  }

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

      <div className="space-y-3 border-t border-white/10 px-3 py-4">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <p className="px-2 text-xs text-slate-500">Cross-tenant management</p>
      </div>
    </aside>
  );
}
