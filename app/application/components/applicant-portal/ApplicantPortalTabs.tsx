"use client";

import type { ApplicantPortalTab } from "./types";
import { WORKER_PORTAL_PAGE_PAD_CLASS, WORKER_SCHEDULE_SUBTITLE_STYLE } from "./worker-schedule-typography";

type Props = {
  activeTab: ApplicantPortalTab;
  onChange: (tab: ApplicantPortalTab) => void;
};

export function ApplicantPortalTabs({ activeTab, onChange }: Props) {
  const tabs: { id: ApplicantPortalTab; label: string }[] = [
    { id: "schedule", label: "Schedule" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div className={`border-b border-[#E5E7EB] ${WORKER_PORTAL_PAGE_PAD_CLASS} pb-0 pt-0`}>
      <div className="inline-flex gap-6">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`border-b-2 px-1 pb-3 pt-5 text-[14px] leading-5 transition ${
                active
                  ? "border-[color:var(--brand-primary)] font-medium text-[color:var(--brand-primary)]"
                  : "border-transparent font-normal text-[#012352] hover:text-[#334155]"
              }`}
              style={WORKER_SCHEDULE_SUBTITLE_STYLE}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
