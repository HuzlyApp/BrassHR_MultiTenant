"use client";

import Image from "next/image";
import { Building2, ImageIcon, Link2 } from "lucide-react";

type AccountTenantHeaderProps = {
  companyName?: string;
  accountNumber?: string;
  accountDomain?: string;
  ownerName: string;
  ownerRole?: string;
  ownerPhoto?: string | null;
  loading?: boolean;
};

export default function AccountTenantHeader({
  companyName = "Nexus MedPro",
  accountNumber = "785325",
  accountDomain = "trial1821he.brasshr.com",
  ownerName,
  ownerRole = "Account Owner",
  ownerPhoto,
  loading = false,
}: AccountTenantHeaderProps) {
  const displayName = loading ? "Loading…" : ownerName || "Mark Sutton";

  return (
    <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-7 text-[#012352]">{companyName}</h2>
          <div className="mt-2 space-y-1.5">
            <p className="flex items-center gap-2 text-sm text-[#64748B]">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--brand-primary,#BC8B41)]" aria-hidden />
              Account #{accountNumber}
            </p>
            <p className="flex items-center gap-2 text-sm text-[#64748B]">
              <Link2 className="h-4 w-4 shrink-0 text-[var(--brand-primary,#BC8B41)]" aria-hidden />
              {accountDomain}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-[#E2E8F0] bg-[#F8FAFC]">
            {ownerPhoto ? (
              <Image
                src={ownerPhoto}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-[#CBD5E1]" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#012352]">{displayName}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{ownerRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
