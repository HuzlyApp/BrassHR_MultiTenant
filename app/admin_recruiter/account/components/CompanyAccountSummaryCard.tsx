"use client";

import { Building2, ImageIcon, Link2 } from "lucide-react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import {
  formatAccountNumber,
  accountRoleLabel,
  getAccountDisplayName,
  getOrganizationDisplayName,
} from "@/lib/account/display-name";
import { resolveImageSrc } from "@/lib/images/resolve-image-src";

const COLORS = {
  headingTitleDark: "#012352",
  textLabels: "#64748B",
  bgPrimary: "#FFFFFF",
} as const;

/** Company + signed-in user summary previously shown on Account billing. */
export default function CompanyAccountSummaryCard() {
  const { user, profile, organization, loading } = useAccountData();
  const displayName = loading ? "—" : getAccountDisplayName(profile, user);
  const companyName = getOrganizationDisplayName(organization, profile, user);
  const accountNumber = formatAccountNumber(organization?.id) ?? "—";
  const accountDomain =
    organization?.domain?.trim() ||
    (organization?.subdomain ? `${organization.subdomain}.brasshr.com` : "—");
  const roleLabel = accountRoleLabel(profile);
  const profileAvatarSrc = resolveImageSrc(profile?.avatar_url);
  const organizationLogoSrc = resolveImageSrc(organization?.logo_url);

  return (
    <div
      className="rounded-lg border px-5 py-4"
      style={{ borderColor: "#E2E8F0", backgroundColor: COLORS.bgPrimary }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="text-base font-semibold sm:text-lg"
            style={{ color: COLORS.headingTitleDark }}
          >
            {companyName}
          </h2>
          <div className="mt-2 space-y-1.5">
            <p className="flex items-center gap-2 text-sm" style={{ color: COLORS.textLabels }}>
              <Building2
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--brand-primary)" }}
                aria-hidden
              />
              Account #{accountNumber}
            </p>
            <p className="flex items-center gap-2 text-sm" style={{ color: COLORS.textLabels }}>
              <Link2
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--brand-primary)" }}
                aria-hidden
              />
              {accountDomain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E2E8F0] bg-[#F8FAFC]">
            {profileAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileAvatarSrc}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : organizationLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizationLogoSrc}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-[#CBD5E1]" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: COLORS.headingTitleDark }}>
              {displayName}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: COLORS.textLabels }}>
              {roleLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
