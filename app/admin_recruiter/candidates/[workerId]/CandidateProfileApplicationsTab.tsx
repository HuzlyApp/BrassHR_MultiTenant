"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  formatProfileMatchStatusLabel,
  type CandidateProfileApplication,
} from "@/lib/admin/candidate-profile-view";
import { formatMatchScore } from "@/lib/jobs/match-analysis/display";
import { jobStatusDisplayLabel } from "@/lib/jobs/job-status";
import { applicationReviewHref } from "./candidate-profile-ui";

const CARD_CLASS = "rounded-xl border border-[#E5E7EB] bg-white";

const TABLE_HEADER_CLASS =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8] first:pl-5 last:pr-5";

const TABLE_CELL_CLASS = "px-4 py-4 align-middle text-sm text-[#0F172A] first:pl-5 last:pr-5";

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function jobStatusLabel(row: CandidateProfileApplication): string {
  if (row.jobStatus?.trim()) return jobStatusDisplayLabel(row.jobStatus);
  return displayValue(row.statusName);
}

type CandidateProfileApplicationsTabProps = {
  applications: CandidateProfileApplication[];
  onScheduleInterview: () => void;
};

export function CandidateProfileApplicationsTab({
  applications,
  onScheduleInterview,
}: CandidateProfileApplicationsTabProps) {
  return (
    <section className={`${CARD_CLASS} mt-5 overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#0F172A]">Applications</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            One person. Each bind has its own pipeline status and match.
          </p>
        </div>
        <button
          type="button"
          onClick={onScheduleInterview}
          disabled={applications.length === 0}
          className="inline-flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Schedule an Interview
        </button>
      </div>

      {applications.length === 0 ? (
        <p className="px-5 py-10 text-sm text-[#64748B]">
          This candidate has not applied to any jobs yet.
        </p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="min-w-[1100px] w-full text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className={TABLE_HEADER_CLASS}>Job Title</th>
                <th className={TABLE_HEADER_CLASS}>Client</th>
                <th className={TABLE_HEADER_CLASS}>Facility</th>
                <th className={TABLE_HEADER_CLASS}>Location/Rem</th>
                <th className={TABLE_HEADER_CLASS}>Bill Rate</th>
                <th className={TABLE_HEADER_CLASS}>Agreed Pay Rate</th>
                <th className={TABLE_HEADER_CLASS}>Status</th>
                <th className={TABLE_HEADER_CLASS}>Match Status</th>
                <th className={TABLE_HEADER_CLASS}>Match Score</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((row) => {
                const matchStatus =
                  row.matchFitLabel?.trim() ||
                  formatProfileMatchStatusLabel(row.matchCategory, row.matchScore);
                const matchScore = formatMatchScore(row.matchScore);
                return (
                  <tr key={row.id} className="border-b border-[#F1F5F9] last:border-b-0">
                    <td className={TABLE_CELL_CLASS}>
                      <Link
                        href={applicationReviewHref(row.id, row.jobRequisitionId)}
                        className="block max-w-[180px] truncate font-medium text-[color:var(--brand-primary)] hover:underline"
                      >
                        {row.jobTitle}
                      </Link>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="block max-w-[140px] truncate">{displayValue(row.clientName)}</span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="block max-w-[160px] truncate">
                        {displayValue(row.facilityName || row.companyName)}
                      </span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <span className="block max-w-[140px] truncate">{displayValue(row.location)}</span>
                    </td>
                    <td className={TABLE_CELL_CLASS}>{displayValue(row.billRate)}</td>
                    <td className={TABLE_CELL_CLASS}>{displayValue(row.agreedPayRate)}</td>
                    <td className={TABLE_CELL_CLASS}>{jobStatusLabel(row)}</td>
                    <td className={TABLE_CELL_CLASS}>{matchStatus}</td>
                    <td className={`${TABLE_CELL_CLASS} font-semibold`}>{matchScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
