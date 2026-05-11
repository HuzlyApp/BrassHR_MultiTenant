"use client";

import { MoreVertical } from "lucide-react";

type DetailedCandidateHeaderProps = {
  name: string;
  role: string;
  loading?: boolean;
};

export default function DetailedCandidateHeader({
  name,
  role,
  loading = false,
}: DetailedCandidateHeaderProps) {
  return (
    <div className="sticky top-0 z-20 mb-4 bg-zinc-50/95 backdrop-blur-sm py-1">
      <div className="mx-auto flex h-[92px] w-full max-w-[1300px] items-center justify-between rounded-md border border-[#D1D5DB] bg-white px-5">
        <div className="flex items-center gap-3">
          <img
            src="/icons/admin-recruiter/user.svg"
            alt="User"
            className="h-[52px] w-[52px] shrink-0"
          />
          <div>
            <div className="text-base font-semibold leading-6 text-[#0D9488]">
              {loading ? "John Doe" : name || "John Doe"}
            </div>
            <div className="mt-0.5 text-xs font-normal leading-4 text-[#4B5563]">
              {role || "Licensed Practical Nurse , LPN"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-xs font-semibold leading-4 text-[#111827] hover:bg-[#F9FAFB]"
          >
            New Applicant
          </button>
          <button
            type="button"
            aria-label="More options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
