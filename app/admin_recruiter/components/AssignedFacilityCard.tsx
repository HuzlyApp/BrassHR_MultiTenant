import type { FacilityListItem } from "@/lib/facilities/types";

function formatAssignedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAssignmentStatus(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  const normalized = status.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function AssignedFacilityCard({ facility }: { facility: FacilityListItem }) {
  const assignedDate = formatAssignedDate(facility.assignedAt);
  const assignmentStatus = formatAssignmentStatus(facility.assignmentStatus);

  return (
    <div className="rounded-xl border border-[#99F6E4] bg-[#F0FDFA]/40 p-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
            }}
          >
            <img
              src="/icons/admin-recruiter/pie_chart_outlined.svg"
              alt=""
              className="h-5 w-5"
              aria-hidden
            />
          </div>
          <div>
            <div className="text-lg font-semibold leading-7 text-black">{facility.name}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#0D9488]">
              Assigned facility
            </div>
          </div>
        </div>
        {assignmentStatus ? (
          <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#047857]">
            {assignmentStatus}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-[#4B5563]">
          <img
            src="/icons/admin-recruiter/locationfacility.svg"
            alt=""
            className="h-5 w-5"
            aria-hidden
          />
          <span>{facility.primaryAddress || "—"}</span>
        </div>
        {facility.secondaryAddress ? (
          <div className="flex items-center gap-2 text-sm text-[#4B5563]">
            <img
              src="/icons/admin-recruiter/corporate_fare.svg"
              alt=""
              className="h-5 w-5"
              aria-hidden
            />
            <span>{facility.secondaryAddress}</span>
          </div>
        ) : null}
        {facility.phone ? (
          <div className="text-sm text-[#4B5563]">
            <span className="font-medium text-[#374151]">Phone:</span> {facility.phone}
          </div>
        ) : null}
        {facility.contactPerson ? (
          <div className="text-sm text-[#4B5563]">
            <span className="font-medium text-[#374151]">Contact:</span> {facility.contactPerson}
          </div>
        ) : null}
        {assignedDate ? (
          <div className="text-sm text-[#4B5563]">
            <span className="font-medium text-[#374151]">Assigned:</span> {assignedDate}
          </div>
        ) : null}
      </div>
    </div>
  );
}
