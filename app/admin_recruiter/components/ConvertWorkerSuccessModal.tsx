"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, ClipboardList, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  formatWorkerDisplayId,
  workerConversionActiveLabel,
  workerConversionEmploymentTypeShort,
  type ConvertWorkerType,
} from "@/lib/admin/convert-candidate-to-worker";

export type ConvertWorkerSuccessData = {
  workerType: ConvertWorkerType;
  workerRecordId: string;
  profilePath: string;
  candidateName: string;
  employeeId?: string | null;
};

type ConvertWorkerSuccessModalProps = {
  open: boolean;
  data: ConvertWorkerSuccessData | null;
  onClose: () => void;
};

function brandGradients(primaryHex: string) {
  return {
    button: `linear-gradient(90deg, ${primaryHex} 0%, color-mix(in srgb, ${primaryHex} 70%, white) 100%)`,
    icon: `linear-gradient(135deg, ${primaryHex} 0%, color-mix(in srgb, ${primaryHex} 65%, white) 100%)`,
  };
}

export default function ConvertWorkerSuccessModal({
  open,
  data,
  onClose,
}: ConvertWorkerSuccessModalProps) {
  const router = useRouter();
  const branding = useTenantBranding();
  const gradients = useMemo(
    () => brandGradients(branding.primaryHex),
    [branding.primaryHex]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !data) return null;

  const workerIdLabel = formatWorkerDisplayId(data.workerRecordId, data.employeeId);
  const employmentLabel = workerConversionEmploymentTypeShort(data.workerType);
  const activeLabel = workerConversionActiveLabel(data.workerType);

  const goToProfile = () => {
    onClose();
    router.push(data.profilePath);
  };

  const goToWorkers = () => {
    onClose();
    router.push("/admin_recruiter/workers");
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-worker-success-title"
        className="relative flex h-[460px] w-full max-w-[600px] flex-col rounded-[20px] border border-[#E5E7EB] bg-white px-8 pb-8 pt-10 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110"
        >
          <X size={12} />
        </button>

        <div className="flex flex-1 flex-col items-center text-center">
          <div
            className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ background: gradients.icon }}
          >
            <Check size={32} className="text-white" strokeWidth={2.5} aria-hidden />
          </div>

          <h2
            id="convert-worker-success-title"
            className="text-2xl font-semibold leading-8 text-[#101828]"
          >
            Worker Successfully Converted!
          </h2>
          <p className="mt-2 text-base leading-6 text-[#4B5563]">
            {data.candidateName} is now {activeLabel}
          </p>

          <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-left">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${branding.primaryHex} 12%, white)`,
                  color: branding.primaryHex,
                }}
              >
                <ClipboardList className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#6B7280]">Worker ID</p>
                <p className="truncate text-sm font-bold text-[#111827]">{workerIdLabel}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-left">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${branding.primaryHex} 12%, white)`,
                  color: branding.primaryHex,
                }}
              >
                <BadgeCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#6B7280]">Employment type</p>
                <p className="truncate text-sm font-bold text-[#111827]">{employmentLabel}</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-[#6B7280]">
            You can now manage their profile, payroll, schedule and more...
          </p>

          <div className="mt-auto flex w-full flex-col gap-3 pt-6 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={goToProfile}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97] sm:max-w-[220px]"
              style={{ background: gradients.button }}
            >
              View Worker Profile
            </button>
            <button
              type="button"
              onClick={goToWorkers}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white text-sm font-semibold text-[#012352] transition hover:bg-[#F9FAFB] sm:max-w-[220px]"
            >
              Go to Workers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
