"use client";

import type { ApplicantPortalTab } from "./types";

type Props = {
  activeTab: ApplicantPortalTab;
  onChange: (tab: ApplicantPortalTab) => void;
};

export function ApplicantPortalTabs({ activeTab, onChange }: Props) {
  const tabs: { id: ApplicantPortalTab; label: string }[] = [
    { id: "schedule", label: "Schedule" },
    { id: "timesheets", label: "Timesheets" },
  ];

  return (
    <div className="px-8 pt-5">
      <div className="inline-flex gap-3.5 rounded-md bg-transparent p-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-2 pb-2.5 pt-1 text-[14px] leading-5 transition ${
                active
                  ? "font-normal text-[color:var(--brand-primary)]"
                  : "font-normal text-[#012352]"
              }`}
              style={active ? { borderBottom: "1.5px solid var(--brand-primary)" } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
