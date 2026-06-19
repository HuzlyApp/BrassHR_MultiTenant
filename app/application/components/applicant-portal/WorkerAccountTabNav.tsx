"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  WORKER_ACCOUNT_TABS,
  type WorkerAccountTab,
  workerAccountTabHref,
} from "./worker-account-types";
import { WORKER_SCHEDULE_SUBTITLE_STYLE } from "./worker-schedule-typography";

type WorkerAccountTabNavProps = {
  activeTab: WorkerAccountTab;
};

export function WorkerAccountTabNav({ activeTab }: WorkerAccountTabNavProps) {
  const pathname = usePathname();
  const onDocumentsRoute = pathname?.includes("/documents");
  const onLicensesRoute = pathname?.includes("/licenses");
  const resolvedTab: WorkerAccountTab = onDocumentsRoute
    ? "documents"
    : onLicensesRoute
      ? "skills"
      : activeTab;

  return (
    <div className="border-b border-[#E5E7EB] bg-white">
      <div className="flex gap-5 overflow-x-auto px-1">
        {WORKER_ACCOUNT_TABS.map((tab) => {
          const active = resolvedTab === tab.id;
          const href =
            tab.id === "documents"
              ? "/application/applicant-dashboard/documents"
              : tab.id === "skills"
                ? "/application/applicant-dashboard/licenses"
                : workerAccountTabHref(tab.id);

          return (
            <Link
              key={tab.id}
              href={href}
              className={`shrink-0 border-b-2 px-1 pb-3 pt-4 text-[14px] leading-5 transition ${
                active
                  ? "border-[color:var(--brand-primary)] font-medium text-[color:var(--brand-primary)]"
                  : "border-transparent font-normal text-[#012352] hover:text-[#334155]"
              }`}
              style={WORKER_SCHEDULE_SUBTITLE_STYLE}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
