"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import {
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Mail,
  MapPin,
  PartyPopper,
  Phone,
  Quote,
  Shield,
} from "lucide-react";
import type {
  OnboardedApplicantViewModel,
  OnboardedProgressMetric,
  OnboardedProgressMetricTheme,
} from "@/lib/admin/onboarded-applicant";
import {
  convertedWorkerSummaryMessage,
  formatConversionDate,
  resolveConvertedWorkerTypeLabel,
  type ConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";
import ConvertWorkerSuccessModal, {
  type ConvertWorkerSuccessData,
} from "@/app/admin_recruiter/components/ConvertWorkerSuccessModal";

type Props = {
  workerId: string;
  data: OnboardedApplicantViewModel;
  onConversionComplete?: () => void | Promise<void>;
};

const FIGMA_CARD =
  "w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white";

const PROGRESS_THEME: Record<
  OnboardedProgressMetricTheme,
  { iconBg: string; Icon: typeof Briefcase; iconClass: string }
> = {
  green: { iconBg: "bg-emerald-100", Icon: Briefcase, iconClass: "text-emerald-600" },
  orange: { iconBg: "bg-orange-100", Icon: ClipboardList, iconClass: "text-orange-600" },
  blue: { iconBg: "bg-blue-100", Icon: FileText, iconClass: "text-blue-600" },
  purple: { iconBg: "bg-violet-100", Icon: Clock, iconClass: "text-violet-600" },
};

function CandidateAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [name]);

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={88}
        height={88}
        className="h-[88px] w-[88px] shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] text-2xl font-bold text-white">
      {initials}
    </div>
  );
}

function ProgressMetricCard({ metric }: { metric: OnboardedProgressMetric }) {
  const theme = PROGRESS_THEME[metric.theme];
  const Icon = theme.Icon;

  return (
    <div className="flex h-[100px] min-w-0 flex-1 basis-0 flex-row flex-nowrap items-center gap-3 rounded-[20px] bg-[#F8FAFC] px-3 py-2">
      <div
        className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg ${theme.iconBg}`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${theme.iconClass}`} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[26px] font-bold leading-none text-black">{metric.value}</p>
        <p className="mt-1 truncate text-xs font-medium leading-4 text-[#374151]">{metric.label}</p>
      </div>
    </div>
  );
}

function ListStatusBadge({
  tone,
  label,
}: {
  tone: "complete" | "signed" | "pending";
  label: string;
}) {
  if (tone === "complete" || tone === "signed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <Check className="h-3 w-3" strokeWidth={3} />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
      {label}
    </span>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
      <h2 className="text-base font-bold text-[#012352]">{title}</h2>
      {action}
    </div>
  );
}

type WorkerType = ConvertWorkerType;

function ConvertWorkerCard({
  type,
  title,
  description,
  features,
  buttonLabel,
  isActive,
  onMouseEnter,
  onMouseLeave,
  onConvert,
  converting,
  disabled,
}: {
  type: WorkerType;
  title: string;
  description: string;
  features: string[];
  buttonLabel: string;
  isActive: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onConvert: (type: WorkerType) => void;
  converting: boolean;
  disabled?: boolean;
}) {
  const Icon = type === "w2" ? Shield : ClipboardList;

  return (
    <div
      className={`flex min-h-[320px] w-full min-w-0 flex-1 basis-0 flex-col rounded-xl border bg-white p-5 transition-colors ${
        isActive
          ? "border-[color:var(--brand-primary)] shadow-[0_0_0_1px_var(--brand-primary)]"
          : "border-[#E5E7EB]"
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isActive
              ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)]"
              : "bg-[#F8FAFC]"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${isActive ? "text-[color:var(--brand-primary)]" : "text-[#6B7280]"}`}
            strokeWidth={2}
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#111827]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#374151]">{description}</p>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-[#374151]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] text-[color:var(--brand-primary)]">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={disabled || converting}
        onClick={() => onConvert(type)}
        className={`mt-auto inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isActive
            ? "bg-[color:var(--brand-primary)] text-white"
            : "border border-[#111827] bg-white text-[#111827]"
        }`}
      >
        {converting ? "Converting…" : buttonLabel}
      </button>
    </div>
  );
}

function ConvertedWorkerStatusCard({
  convertedWorkerType,
  convertedAt,
  workerId,
}: {
  convertedWorkerType: string | null;
  convertedAt: string | null;
  workerId: string;
}) {
  const parsedType = convertedWorkerType?.trim().toLowerCase();
  const Icon = parsedType === "1099" ? ClipboardList : Shield;
  const workerTypeLabel = resolveConvertedWorkerTypeLabel(convertedWorkerType);
  const convertedOn = formatConversionDate(convertedAt);

  return (
    <div className="mt-5 max-w-xl rounded-xl border border-[color:color-mix(in_srgb,var(--brand-primary)_25%,white)] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)]">
          <Icon className="h-5 w-5 text-[color:var(--brand-primary)]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#111827]">{workerTypeLabel}</h3>
          <p className="mt-1 text-sm leading-6 text-[#374151]">
            {convertedWorkerSummaryMessage(convertedWorkerType)}
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-3 border-t border-[#E5E7EB] pt-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#6B7280]">Status</dt>
          <dd>
            <span className="inline-flex rounded-md bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-primary)]">
              Already converted
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#6B7280]">Worker type</dt>
          <dd className="font-semibold text-[#111827]">{workerTypeLabel}</dd>
        </div>
        {convertedOn ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#6B7280]">Converted on</dt>
            <dd className="font-semibold text-[#111827]">{convertedOn}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-5">
        <Link
          href={`/admin_recruiter/workers/${workerId}/profile`}
          className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
        >
          View worker profile
        </Link>
      </div>
    </div>
  );
}

export default function OnboardedApplicantPanel({ workerId, data, onConversionComplete }: Props) {
  const router = useRouter();
  const [hoveredWorkerType, setHoveredWorkerType] = useState<WorkerType | null>(null);
  const [convertingType, setConvertingType] = useState<WorkerType | null>(null);
  const [conversionSuccess, setConversionSuccess] = useState<ConvertWorkerSuccessData | null>(null);
  const activeWorkerType: WorkerType = hoveredWorkerType ?? data.convertedWorkerType ?? "w2";

  const firstName = data.candidateName.split(/\s+/)[0] || data.candidateName;

  async function handleConvert(type: WorkerType) {
    if (data.isConverted || convertingType) return;

    setConvertingType(type);
    try {
      const res = await fetch(`/api/admin/candidates/${encodeURIComponent(workerId)}/convert-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerType: type }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        profilePath?: string;
        workerRecordId?: string;
        workerType?: ConvertWorkerType;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Conversion failed (${res.status})`);
      }

      setConversionSuccess({
        workerType: payload.workerType ?? type,
        workerRecordId: payload.workerRecordId ?? workerId,
        profilePath: payload.profilePath ?? `/admin_recruiter/workers/${workerId}/profile`,
        candidateName: data.candidateName,
        employeeId: data.employeeId,
      });
      await onConversionComplete?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert candidate.");
    } finally {
      setConvertingType(null);
    }
  }

  function handleDownloadReport() {
    const doc = new jsPDF();
    let y = 14;

    const writeLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(value, 140), 52, y);
      y += 7;
      if (y > 275) {
        doc.addPage();
        y = 14;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Onboarded Applicant Report", 14, y);
    y += 10;

    writeLine("Candidate:", data.candidateName);
    writeLine("Role:", data.candidateRole);
    writeLine("Employee ID:", data.employeeId);
    writeLine("Department:", data.department);
    writeLine("Hire Date:", data.hireDate);
    writeLine("Status:", data.currentStatus);
    writeLine("Onboarded:", data.onboardedDate);
    writeLine("Completion:", `${data.onboardingCompletionPercent}%`);

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Onboarding Checklist", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    data.checklistItems.forEach((item) => {
      doc.text(`- ${item.title}: ${item.status}`, 16, y);
      y += 6;
    });

    const filenameBase = data.candidateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    doc.save(`onboarded-applicant-${filenameBase || workerId.slice(0, 8)}.pdf`);
  }

  if (!data.isApproved) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        This page is available after the applicant is approved.{" "}
        <Link
          href={`/admin_recruiter/new/final-approval/${workerId}`}
          className="font-semibold text-[color:var(--brand-primary)] underline"
        >
          Go to Final Approval
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] font-bold text-[#012352]">Onboarded Applicant</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Onboarded
            </span>
          </div>
          <p className="mt-1 text-sm text-[#6B7280]">
            {data.candidateName} has successfully completed onboarding.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <Link
            href={`/admin_recruiter/new/profile/${workerId}`}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
          >
            View Employee Profile
          </Link>
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_min(400px,32%)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className={`${FIGMA_CARD} px-5 py-6`}>
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="flex min-w-0 gap-4">
                <div className="relative shrink-0">
                  <CandidateAvatar name={data.candidateName} photoUrl={data.profilePhotoUrl} />
                  <span className="absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    <Check className="h-3 w-3" strokeWidth={3} />
                    Onboarded
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-[#111827]">{data.candidateName}</div>
                  <div className="text-sm text-[#6B7280]">{data.candidateRole}</div>
                  <div className="mt-3 space-y-2 text-sm text-[#374151]">
                    {data.email ? (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        <span className="truncate">{data.email}</span>
                      </div>
                    ) : null}
                    {data.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        <span>{data.phone}</span>
                      </div>
                    ) : null}
                    {data.address ? (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        <span>{data.address}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-[#6B7280]">Employee ID</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.employeeId}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">Department</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.department}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">Reports To</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.reportsTo}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">Hire Date</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.hireDate}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">Employment Type</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.employmentType}</div>
                </div>
                <div>
                  <div className="text-xs text-[#6B7280]">Current Status</div>
                  <span className="mt-0.5 inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    {data.currentStatus}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className={FIGMA_CARD}>
            <SectionHeader
              title="Onboarded Progress"
              action={
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
              }
            />
            <div className="space-y-4 px-5 py-4">
              <div className="flex w-full flex-row items-stretch gap-3">
                {data.progressMetrics.map((metric) => (
                  <ProgressMetricCard key={metric.id} metric={metric} />
                ))}
              </div>
              <p className="text-sm leading-6 text-[#4B5563]">{data.progressSummary}</p>
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
            <section className={FIGMA_CARD}>
              <SectionHeader
                title="Onboarding Checklist"
                action={
                  <Link
                    href={`/admin_recruiter/new/checklist/${workerId}`}
                    className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                  >
                    View All
                  </Link>
                }
              />
              <ul className="px-5 py-2">
                {data.checklistItems.length === 0 ? (
                  <li className="py-8 text-center text-sm text-[#6B7280]">
                    No checklist items yet.
                  </li>
                ) : (
                  data.checklistItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-3.5 last:border-b-0"
                    >
                      <span className="truncate text-sm font-medium text-[#111827]">{item.title}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.date ? (
                          <span className="text-xs text-[#6B7280]">{item.date}</span>
                        ) : null}
                        <ListStatusBadge tone={item.statusTone} label={item.status} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className={FIGMA_CARD}>
              <SectionHeader
                title="Worker Setup"
                action={
                  <Link
                    href={`/admin_recruiter/new/profile/${workerId}`}
                    className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                  >
                    View All
                  </Link>
                }
              />
              <ul className="px-5 py-2">
                {data.workerSetupItems.length === 0 ? (
                  <li className="py-8 text-center text-sm text-[#6B7280]">
                    No worker setup steps yet.
                  </li>
                ) : (
                  data.workerSetupItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-3.5 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100">
                          <FileText className="h-4 w-4 text-blue-700" />
                        </span>
                        <span className="truncate text-sm font-medium text-[#111827]">{item.title}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.date ? (
                          <span className="text-xs text-[#6B7280]">{item.date}</span>
                        ) : null}
                        <ListStatusBadge tone={item.statusTone} label={item.status} />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-5 xl:max-w-[400px] xl:justify-self-end">
          <section className="rounded-md border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex flex-col items-center px-1 text-center">
              <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white">
                <PartyPopper className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-[#111827]">Welcome to the Team, {firstName}</h2>
              <p className="mt-3 max-w-[320px] text-sm leading-6 text-[#4B5563]">
                Congratulations on completing onboarding. We are excited to have you on the team and
                look forward to your success.
              </p>
            </div>

            <div className="mt-6 grid w-full grid-cols-2 gap-4">
              <div className="flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
                    <Calendar className="h-4 w-4 text-blue-600" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold leading-4 text-[#374151]">Onboarded</span>
                </div>
                <div className="mt-3 text-sm font-bold leading-5 text-[#111827]">{data.onboardedDate}</div>
              </div>
              <div className="flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="text-xs font-semibold leading-4 text-[#374151]">Orientation</div>
                    <div className="text-xs font-semibold leading-4 text-[#374151]">Completed</div>
                  </div>
                </div>
                <div className="mt-3 text-sm font-bold leading-5 text-[#111827]">{data.orientationDate}</div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-lg bg-white/80 p-4 text-left">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
              <p className="text-sm italic leading-6 text-[#6B7280]">
                Every new journey begins with a single step. Welcome aboard!
              </p>
            </div>
          </section>

          <section className={FIGMA_CARD}>
            <SectionHeader title="What&apos;s Next" />
            <ul className="px-5 py-2">
              {data.whatsNextItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] py-3.5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100">
                      <FileText className="h-4 w-4 text-blue-700" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#111827]">{item.title}</div>
                      <p className="mt-0.5 text-xs leading-5 text-[#6B7280]">{item.description}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[#6B7280]">{item.date}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="w-full rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-5">
        <h2 className="text-base font-bold text-[#012352]">Convert to worker</h2>
        {data.isConverted ? (
          <>
            <p className="mt-1 text-sm font-medium text-[#111827]">
              {convertedWorkerSummaryMessage(data.convertedWorkerTypeRaw)}
            </p>
            <ConvertedWorkerStatusCard
              convertedWorkerType={data.convertedWorkerTypeRaw}
              convertedAt={data.convertedAt}
              workerId={workerId}
            />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-[#6B7280]">
              Choose the worker type and complete the conversion process.
            </p>
            <div className="mt-5 flex w-full flex-col gap-4 sm:flex-row">
              <ConvertWorkerCard
                type="w2"
                title="W-2 Employee"
                description="Convert as a W-2 employee. Taxes will be withheld and reported to BrassHR."
                features={[
                  "Full-time or part-time employee",
                  "Taxes withheld by BrassHR",
                  "Appears on payroll",
                ]}
                buttonLabel="Convert to W-2 Employee"
                isActive={activeWorkerType === "w2"}
                onMouseEnter={() => setHoveredWorkerType("w2")}
                onMouseLeave={() => setHoveredWorkerType(null)}
                onConvert={handleConvert}
                converting={convertingType === "w2"}
                disabled={convertingType != null}
              />
              <ConvertWorkerCard
                type="1099"
                title="1099 Contractor"
                description="Convert as a 1099 contractor. Payments will be reported on a 1099 form."
                features={[
                  "Independent contractor",
                  "No taxes withheld by BrassHR",
                  "Paid via contractor payments",
                ]}
                buttonLabel="Convert to 1099 Contractor"
                isActive={activeWorkerType === "1099"}
                onMouseEnter={() => setHoveredWorkerType("1099")}
                onMouseLeave={() => setHoveredWorkerType(null)}
                onConvert={handleConvert}
                converting={convertingType === "1099"}
                disabled={convertingType != null}
              />
            </div>
          </>
        )}
      </section>

      <ConvertWorkerSuccessModal
        open={conversionSuccess != null}
        data={conversionSuccess}
        onClose={() => setConversionSuccess(null)}
      />
    </div>
  );
}
