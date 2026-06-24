"use client";

import type { WorkerAccountProfile } from "./worker-account-types";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type WorkerAccountEmploymentTabProps = {
  profile: WorkerAccountProfile;
};

export function WorkerAccountEmploymentTab({ profile }: WorkerAccountEmploymentTabProps) {
  const rows = [
    ["Employee ID", profile.employeeId],
    ["Hire Date", profile.hireDateLabel],
    ["Employment Type", profile.employmentType],
    ["Department", profile.department],
    ["Job Role", profile.jobRole || "—"],
    ["Hourly Rate", profile.hourlyRate ? `$${profile.hourlyRate} / hr` : "—"],
    [
      "Experience",
      profile.yearsExperience != null ? `${profile.yearsExperience} years` : "—",
    ],
    ["Supervisor", profile.supervisorName ?? "—"],
  ];

  return (
    <section className={`${WORKER_SCHEDULE_CARD_CLASS} w-full lg:w-1/2`}>
      <div className="border-b border-[#E5E7EB] px-4 py-3">
        <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
          Employment Details
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">Your work information from the company.</p>
      </div>
      <dl className="divide-y divide-[#F3F4F6] p-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <dt className="text-[#6B7280]">{label}</dt>
            <dd className="font-medium text-[#111827]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
