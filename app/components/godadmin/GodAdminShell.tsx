"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GodAdminSidebar from "@/app/components/godadmin/GodAdminSidebar";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Props = {
  children: ReactNode;
};

export default function GodAdminShell({ children }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const headers: HeadersInit = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const res = await fetch("/api/auth/god-admin", {
        cache: "no-store",
        headers,
      });
      const payload = (await res.json().catch(() => ({}))) as { godAdmin?: boolean };
      if (!alive) return;

      if (!res.ok || !payload.godAdmin) {
        setDenied(true);
        router.replace("/signin?next=/godadmin/tenants");
        return;
      }

      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Redirecting…
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Verifying God Admin access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <GodAdminSidebar />
      <div className="pl-[260px]">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">God Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Platform-wide tenant and account management</p>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
