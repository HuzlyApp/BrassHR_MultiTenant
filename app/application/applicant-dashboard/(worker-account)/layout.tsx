"use client";

import { Suspense, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkerAccountShell } from "@/app/application/components/applicant-portal/WorkerAccountShell";
import {
  parseWorkerAccountTab,
  type WorkerAccountTab,
} from "@/app/application/components/applicant-portal/worker-account-types";

function resolveActiveTab(pathname: string, tabParam: string | null): WorkerAccountTab {
  if (pathname.includes("/documents") || pathname.includes("/attachments")) {
    return "documents";
  }
  if (pathname.includes("/licenses")) {
    return "skills";
  }
  return parseWorkerAccountTab(tabParam);
}

function WorkerAccountLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const activeTab = useMemo(
    () => resolveActiveTab(pathname, searchParams.get("tab")),
    [pathname, searchParams]
  );

  return <WorkerAccountShell activeTab={activeTab}>{children}</WorkerAccountShell>;
}

/** Keeps profile header + overview API loaded once across profile / documents / licenses tabs. */
export default function WorkerAccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WorkerAccountLayoutInner>{children}</WorkerAccountLayoutInner>
    </Suspense>
  );
}
