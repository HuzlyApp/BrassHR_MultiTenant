"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type ViewerPayload = {
  viewer?: {
    godAdmin?: boolean;
    scoped?: boolean;
    tenantId?: string | null;
    tenantName?: string | null;
  };
};

export default function GodAdminImpersonationBanner() {
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerPayload["viewer"] | null>(null);
  const [exiting, setExiting] = useState(false);

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
      const payload = (await res.json().catch(() => ({}))) as ViewerPayload;
      if (alive) setViewer(payload.viewer ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

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
          God Admin view mode: viewing as{" "}
          <span className="font-semibold">{viewer.tenantName ?? "selected tenant"}</span>{" "}
          <span className="text-amber-800/90">(Admin Recruiter)</span>
        </p>
        <button
          type="button"
          onClick={() => void exit()}
          disabled={exiting}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-60"
        >
          {exiting ? "Exiting..." : "Exit to Platform Console"}
        </button>
      </div>
    </div>
  );
}
