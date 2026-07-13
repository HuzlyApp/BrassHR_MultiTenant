"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Download, Pencil, Plus, Star, Wallet } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { formatDecimalHours } from "./worker-dashboard-utils";
import type { WorkerAccountOverviewPayload } from "./worker-account-types";
import {
  useWorkerAccountActions,
  useWorkerAccountReadOnly,
  useWorkerAccountTabHref,
} from "./WorkerAccountContext";
import { EditAboutMeModal } from "./EditAboutMeModal";
import { EditWorkerSkillsModal } from "./EditWorkerSkillsModal";
import { WORKER_BTN_GHOST_ICON, WORKER_BTN_OUTLINE } from "./worker-portal-buttons";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

function AccountCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={WORKER_SCHEDULE_CARD_CLASS}>
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CardActionLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:underline"
    >
      {icon}
      {label}
    </Link>
  );
}

function CardActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:underline"
    >
      {icon}
      {label}
    </button>
  );
}

function WorkSummaryStat({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#6B7280]">{label}</p>
        <p className="mt-1 text-[20px] font-semibold leading-7 text-[#111827]">{value}</p>
      </div>
    </div>
  );
}

function formatCurrency(value: number | null): string {
  if (value == null) return "Soon";
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type WorkerAccountOverviewProps = {
  data: WorkerAccountOverviewPayload;
  onDownloadDocument: (source: "portal" | "required", id: string) => void;
};

export function WorkerAccountOverview({ data, onDownloadDocument }: WorkerAccountOverviewProps) {
  const readOnly = useWorkerAccountReadOnly();
  const tabHref = useWorkerAccountTabHref();
  const { refreshOverview } = useWorkerAccountActions();
  const [editSkillsOpen, setEditSkillsOpen] = useState(false);
  const [editAboutMeOpen, setEditAboutMeOpen] = useState(false);
  const { aboutMe, skills, certifications, recentDocuments, workSummary } = data;

  return (
    <>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <AccountCard
          title="About Me"
          action={
            readOnly ? undefined : (
              <CardActionButton
                label="Edit About Me"
                icon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => setEditAboutMeOpen(true)}
              />
            )
          }
        >
          <p className="text-sm leading-6 text-[#374151]">{aboutMe}</p>
        </AccountCard>

        <AccountCard
          title="Skills"
          action={
            readOnly ? undefined : (
              <CardActionButton
                label="Edit Skills"
                icon={<Pencil className="h-4 w-4" aria-hidden />}
                onClick={() => setEditSkillsOpen(true)}
              />
            )
          }
        >
          {skills.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No skills added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </AccountCard>

        <AccountCard
          title="Certifications"
          action={
            readOnly ? undefined : (
              <CardActionLink
                href={tabHref("skills")}
                label="Add Certification"
                icon={<Plus className="h-4 w-4" aria-hidden />}
              />
            )
          }
        >
          {certifications.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No certifications uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {certifications.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandedFileTypeIcon type="pdf" className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{item.title}</p>
                      <p className="text-xs text-[#6B7280]">
                        {item.expiresLabel ? `Expires ${item.expiresLabel}` : item.statusLabel}
                      </p>
                    </div>
                  </div>
                  {!readOnly ? (
                    <Link href={tabHref("skills")} className={WORKER_BTN_OUTLINE}>
                      Update
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </AccountCard>
      </div>

      <div className="space-y-4">
        <AccountCard title="Work Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkSummaryStat
              label="Total Shifts"
              value={String(workSummary.totalShifts)}
              icon={<CalendarDays className="h-8 w-8" strokeWidth={1.5} aria-hidden />}
              iconBg="#DBEAFE"
              iconColor="#2563EB"
            />
            <WorkSummaryStat
              label="Hours Worked"
              value={formatDecimalHours(workSummary.hoursWorked)}
              icon={<Clock className="h-8 w-8" strokeWidth={1.5} aria-hidden />}
              iconBg="#D6FFE6"
              iconColor="#00B546"
            />
            {/* Earnings and Rating hidden for now in admin worker profile */}
            {!readOnly ? (
              <WorkSummaryStat
                label="Earnings"
                value={formatCurrency(workSummary.earnings)}
                icon={<Wallet className="h-8 w-8" strokeWidth={1.5} aria-hidden />}
                iconBg="#FFECD6"
                iconColor="#F97316"
              />
            ) : null}
            {!readOnly ? (
              <WorkSummaryStat
                label="Rating"
                value={workSummary.rating != null ? `${workSummary.rating.toFixed(1)} / 5` : "Soon"}
                icon={<Star className="h-8 w-8" strokeWidth={1.5} aria-hidden />}
                iconBg="#FEF9C3"
                iconColor="#CA8A04"
              />
            ) : null}
          </div>
        </AccountCard>

        <AccountCard
          title="Recent Documents"
          action={
            readOnly ? undefined : (
              <CardActionLink href="/application/applicant-dashboard/documents" label="View All" />
            )
          }
        >
          {recentDocuments.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentDocuments.map((doc) => (
                <li
                  key={`${doc.source}-${doc.id}`}
                  className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandedFileTypeIcon type="pdf" className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{doc.title}</p>
                      <p className="text-xs text-[#6B7280]">{doc.uploadedLabel}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownloadDocument(doc.source, doc.id)}
                    className={`${WORKER_BTN_GHOST_ICON} shrink-0 border border-[#E5E7EB]`}
                    aria-label={`Download ${doc.title}`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AccountCard>
      </div>
    </div>

    {!readOnly ? (
      <>
        <EditAboutMeModal
          open={editAboutMeOpen}
          initialAboutMe={aboutMe}
          onClose={() => setEditAboutMeOpen(false)}
          onSaved={refreshOverview}
        />
        <EditWorkerSkillsModal
          open={editSkillsOpen}
          onClose={() => setEditSkillsOpen(false)}
          onChanged={refreshOverview}
        />
      </>
    ) : null}
    </>
  );
}
