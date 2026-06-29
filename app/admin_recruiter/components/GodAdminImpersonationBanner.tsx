"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useEffectiveBranding } from "@/lib/admin/hooks/use-effective-branding";

export default function GodAdminImpersonationBanner() {
  const router = useRouter();
  const { viewer } = useEffectiveBranding();
  const [exiting, setExiting] = useState(false);

  if (!viewer?.godAdmin || !viewer.scoped) return null;

  const exit = async () => {
    setExiting(true);
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    await fetch("/api/admin/view-as-tenant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ tenantId: null }),
    });
    router.push("/godadmin/tenants");
    router.refresh();
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Viewing as <strong>{viewer.tenantName ?? "tenant"}</strong> (god admin impersonation).
        </p>
        <button
          type="button"
          disabled={exiting}
          onClick={() => void exit()}
          className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60"
        >
          {exiting ? "Exiting…" : "Exit view-as"}
        </button>
      </div>
    </div>
  );
}
