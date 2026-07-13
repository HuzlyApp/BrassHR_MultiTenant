"use client";

import type { ReactNode } from "react";
import { WorkerAccountProvider } from "./WorkerAccountContext";
import { WorkerAccountHeader } from "./WorkerAccountHeader";
import { WorkerAccountTabNav } from "./WorkerAccountTabNav";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "./worker-account-types";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "./worker-schedule-typography";

type WorkerAccountShellLayoutProps = {
  activeTab: WorkerAccountTab;
  children: ReactNode;
  overview: WorkerAccountOverviewPayload | null;
  error: string | null;
  readOnly: boolean;
  tabHref: (tab: WorkerAccountTab) => string;
  updateProfilePhoto: (url: string | null) => void;
  refreshOverview: () => Promise<void>;
  loading?: boolean;
  hideTabs?: boolean;
};

export function WorkerAccountShellLayout({
  activeTab,
  children,
  overview,
  error,
  readOnly,
  tabHref,
  updateProfilePhoto,
  refreshOverview,
  loading = false,
  hideTabs = false,
}: WorkerAccountShellLayoutProps) {
  const profile =
    overview?.profile ??
    ({
      id: "",
      tenantId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      jobRole: "",
      statusLabel: "approved",
      displayName: "",
      fullAddress: "—",
      employeeId: "—",
      hireDateLabel: "—",
      employmentType: "—",
      department: "—",
      supervisorName: null,
      hourlyRate: null,
      positions: [],
      yearsExperience: null,
      profileCompletionPercent: 0,
      profilePhotoUrl: null,
    } satisfies WorkerAccountOverviewPayload["profile"]);

  return (
    <div className="w-full min-w-0">
      <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-4`}>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <WorkerAccountHeader
          profile={profile}
          loading={loading}
          readOnly={readOnly}
          tabHref={tabHref}
          onProfilePhotoUpdated={readOnly ? undefined : updateProfilePhoto}
        />
      </div>

      {hideTabs ? null : (
        <div className="sticky top-16 z-20 border-b border-[#E5E7EB]">
          <WorkerAccountTabNav activeTab={activeTab} />
        </div>
      )}

      <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pt-4`}>
        <WorkerAccountProvider
          value={{ overview, updateProfilePhoto, refreshOverview, readOnly, tabHref }}
        >
          {children}
        </WorkerAccountProvider>
      </div>
    </div>
  );
}
