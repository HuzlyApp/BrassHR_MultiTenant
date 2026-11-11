"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Download, Info, Printer } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { isRemoteOrBlobImageSrc, normalizeBrandingImageSrc } from "@/lib/tenant/tenant-branding";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import {
  DEMO_EMPLOYEE_FALLBACK,
  DEMO_PAYSLIPS,
  formatPayCurrency,
  type WorkerPayslip,
} from "./worker-pay-demo";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

const DEFAULT_LOGO = "/images/new-logo-nexus.svg";
const NAVY = "var(--brand-secondary, #012352)";

function PayslipDocument({
  payslip,
  logoSrc,
  companyName,
  employeeDisplayName,
}: {
  payslip: WorkerPayslip;
  logoSrc: string;
  companyName: string;
  employeeDisplayName: string;
}) {
  return (
    <article
      className={`${WORKER_SCHEDULE_CARD_CLASS} shadow-sm print:border-0 print:shadow-none`}
      id="worker-payslip-document"
    >
      <div className="border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F8FAFC]">
              {isRemoteOrBlobImageSrc(logoSrc) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <Image src={logoSrc} alt="" fill className="object-contain p-1" sizes="40px" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">{companyName || payslip.companyName}</p>
              {payslip.companyAddress.map((line) => (
                <p key={line} className="text-xs leading-5 text-[#6B7280]">
                  {line}
                </p>
              ))}
              <p className="text-xs leading-5 text-[#6B7280]">{payslip.companyPhone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-[#111827]">{payslip.monthLabel}</p>
            <p className="text-xs text-[#6B7280]">Earning Statement</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-[#E5E7EB] px-5 py-4 sm:grid-cols-2 sm:px-6">
        <div className="space-y-1.5 text-sm">
          <p>
            <span className="text-[#6B7280]">Employee: </span>
            <span className="font-semibold text-[#111827]">{employeeDisplayName}</span>
          </p>
          <p>
            <span className="text-[#6B7280]">Employee ID: </span>
            <span className="font-medium text-[#111827]">{payslip.employeeId}</span>
          </p>
          <p>
            <span className="text-[#6B7280]">Department: </span>
            <span className="font-medium text-[#111827]">{payslip.department}</span>
          </p>
          <p>
            <span className="text-[#6B7280]">Position: </span>
            <span className="font-medium text-[#111827]">{payslip.position}</span>
          </p>
        </div>
        <div className="space-y-1.5 text-sm sm:text-right">
          <p>
            <span className="text-[#6B7280]">Pay Period: </span>
            <span className="font-medium text-[#111827]">{payslip.periodLabel}</span>
          </p>
          <p>
            <span className="text-[#6B7280]">Pay Date: </span>
            <span className="font-medium text-[#111827]">{payslip.payDateLabel}</span>
          </p>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <PayslipTable
          title="Earnings"
          rows={payslip.earnings}
          totalLabel="Total Earnings"
          total={payslip.totalEarnings}
          showRateColumns
        />
        <PayslipTable
          title="Deductions"
          rows={payslip.deductions}
          totalLabel="Total Deductions"
          total={payslip.totalDeductions}
        />

        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-white"
          style={{ backgroundColor: NAVY }}
        >
          <span className="text-sm font-semibold">Net Pay</span>
          <span className="text-lg font-bold tracking-tight">{formatPayCurrency(payslip.netPay)}</span>
        </div>

        <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Year-to-Date Summary
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <YtdStat label="Earnings YTD" value={payslip.ytdEarnings} />
            <YtdStat label="Deductions YTD" value={payslip.ytdDeductions} />
            <YtdStat label="Net Pay YTD" value={payslip.ytdNetPay} />
          </div>
        </div>
      </div>
    </article>
  );
}

function PayslipTable({
  title,
  rows,
  totalLabel,
  total,
  showRateColumns = false,
}: {
  title: string;
  rows: WorkerPayslip["earnings"];
  totalLabel: string;
  total: number;
  showRateColumns?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
      <div
        className="px-4 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: NAVY }}
      >
        {title}
      </div>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            <th className="px-4 py-2.5">Description</th>
            {showRateColumns ? (
              <>
                <th className="whitespace-nowrap px-4 py-2.5">Hours</th>
                <th className="whitespace-nowrap px-4 py-2.5">Rate</th>
              </>
            ) : null}
            <th className="whitespace-nowrap px-4 py-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.description} className="border-b border-[#E5E7EB] last:border-b-0">
              <td className="px-4 py-2.5 text-[#111827]">{row.description}</td>
              {showRateColumns ? (
                <>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#374151]">
                    {row.hours ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#374151]">
                    {row.rate ?? "—"}
                  </td>
                </>
              ) : null}
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-[#111827]">
                {formatPayCurrency(row.amount)}
              </td>
            </tr>
          ))}
          <tr className="bg-[#F8FAFC]">
            <td
              colSpan={showRateColumns ? 3 : 1}
              className="px-4 py-2.5 text-sm font-semibold text-[#111827]"
            >
              {totalLabel}
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-bold text-[#111827]">
              {formatPayCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function YtdStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#111827]">{formatPayCurrency(value)}</p>
    </div>
  );
}

export function WorkerPayslipsClient() {
  const branding = useTenantBranding();
  const { session } = useApplicantPortal();
  const [selectedId, setSelectedId] = useState(DEMO_PAYSLIPS[0]?.id ?? "");

  const logoSrc = useMemo(
    () => normalizeBrandingImageSrc(branding.logoUrl || branding.faviconUrl, DEFAULT_LOGO),
    [branding.faviconUrl, branding.logoUrl]
  );

  const selected = DEMO_PAYSLIPS.find((p) => p.id === selectedId) ?? DEMO_PAYSLIPS[0];
  const employeeDisplayName =
    session?.applicant.name?.trim() || selected?.employeeName || DEMO_EMPLOYEE_FALLBACK;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
  };

  if (!selected) return null;

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
            Payslips
          </h1>
          <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
            View and download your payslips.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-95"
            style={{ backgroundColor: NAVY }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <PayslipDocument
          payslip={selected}
          logoSrc={logoSrc}
          companyName={branding.companyName || selected.companyName}
          employeeDisplayName={employeeDisplayName}
        />

        <aside className={`${WORKER_SCHEDULE_CARD_CLASS} flex h-fit flex-col shadow-sm print:hidden`}>
          <div className="border-b border-[#E5E7EB] px-4 py-3.5">
            <h2 className="text-sm font-semibold text-[#111827]">Your Payslips</h2>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {DEMO_PAYSLIPS.map((payslip) => {
              const active = payslip.id === selected.id;
              return (
                <li key={payslip.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-3 transition ${
                      active ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(payslip.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#111827]">
                          {payslip.monthLabel}
                        </span>
                        <span className="inline-flex rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                          Paid
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-[#374151]">
                        {formatPayCurrency(payslip.netPay)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(payslip.id);
                        window.setTimeout(() => window.print(), 50);
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                      aria-label={`Download ${payslip.monthLabel} payslip`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="m-3 mt-auto flex gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden />
            <p className="text-xs leading-5 text-[#1E40AF]">
              Payslip are available for the last 12 months.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
