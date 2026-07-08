"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import {
  Briefcase,
  Calendar,
  Check,
  ClipboardList,
  Download,
  FileText,
  Hash,
  Info,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Rocket,
  Search,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import SuccessModal from "@/app/components/SuccessModal";
import CandidateCommunicationDialog from "@/app/admin_recruiter/components/CandidateCommunicationDialog";
import type {
  FinalApprovalMetric,
  FinalApprovalMetricTheme,
  FinalApprovalViewModel,
} from "@/lib/admin/final-approval";

type Props = {
  workerId: string;
  data: FinalApprovalViewModel;
  onRefresh?: () => void;
};

const FIGMA_CARD =
  "w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white";

const METRIC_THEME: Record<
  FinalApprovalMetricTheme,
  { iconBg: string; Icon: typeof Briefcase; iconClass: string }
> = {
  green: {
    iconBg: "bg-emerald-100",
    Icon: Briefcase,
    iconClass: "text-emerald-600",
  },
  orange: {
    iconBg: "bg-orange-100",
    Icon: Lightbulb,
    iconClass: "text-orange-600",
  },
  blue: {
    iconBg: "bg-blue-100",
    Icon: FileText,
    iconClass: "text-blue-600",
  },
  yellow: {
    iconBg: "bg-amber-100",
    Icon: Users,
    iconClass: "text-amber-600",
  },
};

const EVALUATION_ICONS: Record<string, { bg: string; icon: React.ReactNode }> = {
  w4: { bg: "bg-emerald-100", icon: <FileText className="h-4 w-4 text-emerald-700" /> },
  skill: { bg: "bg-blue-100", icon: <ClipboardList className="h-4 w-4 text-blue-700" /> },
  interview: { bg: "bg-orange-100", icon: <Target className="h-4 w-4 text-orange-700" /> },
  reference: { bg: "bg-amber-100", icon: <UserPlus className="h-4 w-4 text-amber-700" /> },
  drug: { bg: "bg-amber-100", icon: <UserPlus className="h-4 w-4 text-amber-700" /> },
  background: { bg: "bg-red-100", icon: <Search className="h-4 w-4 text-red-700" /> },
};

function statusBadgeClass(tone: FinalApprovalViewModel["currentStatusTone"]): string {
  switch (tone) {
    case "approved":
    case "final":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "for_approval":
      return "bg-orange-100 text-orange-800";
    case "disapproved":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function ScoreRing({ percent }: { percent: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#D1FAE5" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-emerald-600"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-lg font-bold text-emerald-700">
        {percent}%
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: FinalApprovalMetric }) {
  const theme = METRIC_THEME[metric.theme];
  const Icon = theme.Icon;

  return (
    <div className="flex h-[100px] min-w-0 flex-1 basis-0 flex-row flex-nowrap items-center gap-3 rounded-[20px] bg-[#F8FAFC] px-3 py-2">
      <div
        className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center self-center rounded-lg ${theme.iconBg}`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${theme.iconClass}`} strokeWidth={2} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate text-xs font-medium leading-4 text-[#374151]">{metric.label}</p>
        <p className="mt-1 text-[26px] font-bold leading-none text-black">{metric.percent}%</p>
        <p className="mt-1 truncate text-sm font-semibold leading-5 text-[#374151]">{metric.rating}</p>
      </div>
    </div>
  );
}

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
        width={72}
        height={72}
        className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] text-xl font-bold text-white">
      {initials}
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-[#012352]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function FinalApprovalPanel({ workerId, data, onRefresh }: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);

  async function patchStatus(status: "approved" | "pending" | "disapproved") {
    const res = await fetch("/api/admin/workers/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, status }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      approvalEmail?: { sent?: boolean; skipped?: boolean; error?: string };
    };
    if (!res.ok) throw new Error(json.error || "Action failed");
    return json;
  }

  async function handleApprove() {
    if (!confirmed) {
      toast.error("Please confirm review before approving.");
      return;
    }
    setApproving(true);
    try {
      await patchStatus("approved");
      setShowApprovalSuccess(true);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve candidate.");
    } finally {
      setApproving(false);
    }
  }

  async function handleRequestChanges() {
    setRequestingChanges(true);
    try {
      await patchStatus("pending");
      toast.success("Candidate moved to pending. Send update request below.");
      setCommunicationOpen(true);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request changes.");
    } finally {
      setRequestingChanges(false);
    }
  }

  async function handleReject() {
    const ok = window.confirm(`Reject ${data.candidateName}? This cannot be undone easily.`);
    if (!ok) return;
    setRejecting(true);
    try {
      await patchStatus("disapproved");
      toast.success("Candidate rejected.");
      onRefresh?.();
      router.push("/admin_recruiter/disapproved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reject candidate.");
    } finally {
      setRejecting(false);
    }
  }

  function handleDownloadReport() {
    const doc = new jsPDF();
    let y = 14;

    const writeLabelValue = (label: string, value: string) => {
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
    doc.text("Final Approval Report", 14, y);
    y += 10;

    writeLabelValue("Candidate:", data.candidateName);
    writeLabelValue("Role:", data.candidateRole);
    writeLabelValue("Applied for:", data.appliedFor);
    writeLabelValue("Application Date:", data.applicationDate);
    writeLabelValue("Current Status:", data.currentStatus);
    writeLabelValue("AI Score:", `${data.aiConfidenceScore}% (${data.matchLabel})`);
    writeLabelValue(
      "Recommendation:",
      `${data.candidateName} demonstrates strong alignment with the role requirements.`
    );

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Evaluation Summary", 14, y);
    y += 6;
    doc.setDrawColor(230, 230, 230);
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    data.evaluationItems.forEach((item) => {
      doc.text(`- ${item.label}: ${item.status}`, 16, y);
      y += 6;
      if (y > 275) {
        doc.addPage();
        y = 14;
      }
    });

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Onboarding Documents", 14, y);
    y += 6;
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    data.documents.forEach((docRow) => {
      doc.text(
        `- ${docRow.title}: ${docRow.status === "ready" ? "Ready" : "Pending"}`,
        16,
        y
      );
      y += 6;
      if (y > 275) {
        doc.addPage();
        y = 14;
      }
    });

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Top Strengths", 14, y);
    y += 6;
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    data.strengths.forEach((strength) => {
      doc.text(`- ${strength.text}`, 16, y);
      y += 6;
      if (y > 275) {
        doc.addPage();
        y = 14;
      }
    });

    const filenameBase = data.candidateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const safeBase = filenameBase || workerId.slice(0, 8);
    doc.save(`final-approval-${safeBase}.pdf`);
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-[#012352]">Final Approval of Applicant</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              Review and approve the applicant for onboarding
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
        </div>

        {/* Figma: left ~876px column + right ~400px column, gap 20 */}
        <div className="grid w-full min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_min(400px,32%)]">
          {/* LEFT COLUMN — gap 20px */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Profile card — 876×187, padding 24/20 */}
            <section className={`${FIGMA_CARD} min-h-[187px] px-5 py-6`}>
              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                <div className="flex min-w-0 gap-4">
                  <CandidateAvatar name={data.candidateName} photoUrl={data.profilePhotoUrl} />
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
                    <div className="text-xs text-[#6B7280]">Applied for</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.appliedFor}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Application Date</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.applicationDate}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Job ID</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.jobId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Source</div>
                    <div className="mt-0.5 text-sm font-semibold text-[#111827]">{data.source}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-[#6B7280]">Current Status</div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(data.currentStatusTone)}`}
                    >
                      {data.currentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* AI Candidate Summary — 876×224 */}
            <section className={`${FIGMA_CARD} min-h-[224px]`}>
              <SectionHeader
                title="AI Candidate Summary"
                icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
              />
              <div className="space-y-4 px-5 py-4">
                <div className="grid w-full grid-cols-2 gap-3 md:flex md:flex-row md:items-stretch">
                  {data.metrics.map((metric) => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
                </div>
                <p className="text-sm leading-6 text-[#4B5563]">{data.recommendationSummary}</p>
              </div>
            </section>

            {/* Evaluation + Documents — two 428px cards, gap 20 */}
            <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2">
              <section className={`${FIGMA_CARD} min-h-[397px]`}>
                <SectionHeader title="Application & Evaluation Summary" />
                <ul className="px-5 py-2">
                  {data.evaluationItems.map((item) => {
                    const iconDef = EVALUATION_ICONS[item.id] ?? EVALUATION_ICONS.w4;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-3.5 last:border-b-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconDef.bg}`}
                          >
                            {iconDef.icon}
                          </span>
                          <span className="truncate text-sm font-medium text-[#111827]">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`text-sm font-semibold ${
                              item.tone === "pass" ? "text-[#111827]" : "text-amber-700"
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.tone === "pass" ? (
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className={`${FIGMA_CARD} min-h-[397px]`}>
                <SectionHeader
                  title="Onboarding Documents"
                  action={
                    <Link
                      href={`/admin_recruiter/new/attachments/${workerId}`}
                      className="text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
                    >
                      View All
                    </Link>
                  }
                />
                <ul className="px-5 py-2">
                  {data.documents.length === 0 ? (
                    <li className="py-8 text-center text-sm text-[#6B7280]">No documents yet.</li>
                  ) : (
                    data.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-3.5 last:border-b-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </span>
                          <span className="truncate text-sm font-medium text-[#111827]">
                            {doc.title}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            doc.status === "ready"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {doc.status === "ready" ? "Ready" : "Pending"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          </div>

          {/* RIGHT COLUMN — 400px, gap 20 */}
          <div className="flex w-full min-w-0 flex-col gap-5 xl:max-w-[400px] xl:justify-self-end">
            {/* AI Recommendation — 400×424 */}
            <section className={`${FIGMA_CARD} min-h-[424px]`}>
              <SectionHeader
                title="AI Recommendation"
                icon={<Sparkles className="h-5 w-5 text-amber-500" />}
              />
              <div className="space-y-4 px-5 py-4">
                <div className="rounded-md bg-emerald-50 p-4">
                  <div className="flex items-center gap-4">
                    <ScoreRing percent={data.aiConfidenceScore} />
                    <div>
                      <div className="text-lg font-bold text-[#111827]">{data.matchLabel}</div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-[#6B7280]">
                        AI Confidence Score
                        <Info className="h-4 w-4" aria-hidden />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm leading-6 text-[#4B5563]">
                  <span className="font-semibold text-[#111827]">{data.candidateName}</span>{" "}
                  demonstrates strong alignment with the role requirements. Skills and assessment
                  results indicate a high probability of success in this position.
                </p>

                <div className="border-t border-[#E5E7EB] pt-4">
                  <div className="text-sm font-bold text-[#111827]">Top Strengths</div>
                  <ul className="mt-3 space-y-2.5">
                    {data.strengths.map((strength) => (
                      <li key={strength.id} className="flex items-start gap-2 text-sm text-[#374151]">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span>{strength.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Ready to Onboard — 400×404, padding 20, gap 24 */}
            <section className="flex min-h-[404px] w-full flex-col gap-6 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-[color:var(--brand-primary)]">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#012352]">Ready to Onboard</h2>
                  <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                    This candidate is ready for onboarding.
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 text-[#4B5563]">
                By approving,{" "}
                <span className="font-semibold text-[#111827]">{data.candidateName}</span> will be
                moved to the Onboarding stage and notified to complete the onboarding process.
              </p>

              {data.showActions ? (
                <>
                  <label className="flex cursor-pointer items-start gap-3">
                    <span
                      className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border ${
                        confirmed
                          ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]"
                          : "border-[#e2e8f0] bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                        aria-label="Confirm final approval"
                      />
                      {confirmed ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                    </span>
                    <span className="text-sm font-semibold leading-6 text-[#111827]">
                      I confirm that I have reviewed all information and approve this candidate for
                      onboarding.
                    </span>
                  </label>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approving || !confirmed}
                      className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approving ? "Approving..." : "Approved & Move to Onboarding"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestChanges}
                      disabled={requestingChanges}
                      className="inline-flex h-12 w-full items-center justify-center rounded-lg border-2 border-[color:var(--brand-primary)] bg-white px-4 text-sm font-bold text-[color:var(--brand-primary)] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestingChanges ? "Saving..." : "Request Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejecting}
                      className="text-center text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      {rejecting ? "Rejecting..." : "Reject Applicant"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {data.currentStatusTone === "approved"
                    ? "This candidate is already approved. No further action needed."
                    : data.currentStatusTone === "disapproved"
                      ? "This candidate was rejected."
                      : "Approval actions are not available."}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <CandidateCommunicationDialog
        open={communicationOpen}
        onClose={() => setCommunicationOpen(false)}
        workerId={workerId}
        candidateName={data.candidateName}
        email={data.email}
        phone={data.phone}
        initialChannel="email"
        onSent={() => setCommunicationOpen(false)}
      />

      <SuccessModal
        open={showApprovalSuccess}
        onClose={() => {
          setShowApprovalSuccess(false);
          onRefresh?.();
        }}
        size="large"
        title="Success!"
        message={
          <>
            <p>Applicant onboarding has been approved.</p>
            <p>
              <span className="font-semibold text-[#111827]">{data.candidateName}</span> will receive
              an email for onboarding.
            </p>
          </>
        }
        actionLabel="Go to Onboarding"
        onAction={() => {
          router.push(`/admin_recruiter/new/onboard-applicant/${workerId}`);
          router.refresh();
        }}
      />
    </>
  );
}
