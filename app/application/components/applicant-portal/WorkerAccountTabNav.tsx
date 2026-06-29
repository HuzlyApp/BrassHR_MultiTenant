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
    <nav className="w-full min-w-0" aria-label="Account sections">
      <div className="worker-account-tabs-scroll overflow-x-auto pb-1">
        <div className="mx-auto flex w-max min-w-full flex-nowrap items-end justify-start gap-4 px-4 sm:justify-center sm:gap-5 min-[1000px]:px-8">
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
                className={`inline-flex shrink-0 flex-col items-center whitespace-nowrap border-b-2 px-1 pb-3 pt-3 text-[13px] leading-5 transition sm:pt-4 sm:text-[14px] ${
                  active
                    ? "border-[color:var(--brand-primary)] font-medium text-[color:var(--brand-primary)]"
                    : "border-transparent font-normal text-[#012352] hover:border-[color:color-mix(in_srgb,var(--brand-primary)_25%,transparent)] hover:text-[color:var(--brand-primary)]"
                }`}
                style={WORKER_SCHEDULE_SUBTITLE_STYLE}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
