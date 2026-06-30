"use client";

import { useWorkerAccountOverview } from "./WorkerAccountContext";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[#374151]">{label}</p>
      <p className="min-h-10 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#111827]">
        {value.trim() || "—"}
      </p>
    </div>
  );
}

export function WorkerAccountPersonalView() {
  const overview = useWorkerAccountOverview();
  const profile = overview?.profile;

  if (!profile) {
    return (
      <section className={WORKER_SCHEDULE_CARD_CLASS}>
        <div className="p-4 text-sm text-[#6B7280]">Loading profile...</div>
      </section>
    );
  }

  return (
    <section className={WORKER_SCHEDULE_CARD_CLASS}>
      <div className="border-b border-[#E5E7EB] px-4 py-3">
        <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
          Personal Information
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">Worker contact and address details.</p>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <ReadOnlyField label="First name" value={profile.firstName} />
        <ReadOnlyField label="Last name" value={profile.lastName} />
        <ReadOnlyField label="Email" value={profile.email} />
        <ReadOnlyField label="Phone" value={profile.phone} />
        <div className="md:col-span-2">
          <ReadOnlyField label="Street address" value={profile.address1} />
        </div>
        <ReadOnlyField label="Address line 2" value={profile.address2} />
        <ReadOnlyField label="City" value={profile.city} />
        <ReadOnlyField label="State" value={profile.state} />
        <ReadOnlyField label="ZIP code" value={profile.zip} />
        <ReadOnlyField label="Role" value={profile.jobRole || "—"} />
      </div>
    </section>
  );
}
