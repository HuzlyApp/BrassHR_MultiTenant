"use client";

import { Suspense, useEffect, useState } from "react";
import AssessmentSettingsPanel from "@/app/admin_recruiter/settings/AssessmentSettingsPanel";

type Props = {
  professionId: string;
};

export default function AssessmentProfessionDetailClient({ professionId }: Props) {
  const [professionName, setProfessionName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/profession-documents", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          professions?: Array<{ id: string; name: string }>;
        };
        const match = (payload.professions ?? []).find((row) => row.id === professionId);
        if (!cancelled && match?.name) setProfessionName(match.name);
      } catch {
        /* panel still loads with empty name */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionId]);

  return (
    <Suspense
      fallback={
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm text-[#64748B]">Loading assessment settings…</p>
        </section>
      }
    >
      <AssessmentSettingsPanel
        fullPage
        professionId={professionId}
        professionName={professionName || null}
      />
    </Suspense>
  );
}
