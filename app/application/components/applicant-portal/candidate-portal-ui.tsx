"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  brandBodyTextStyle,
  brandHeadingTextStyle,
} from "@/lib/tenant/branding-typography-styles";
import { applicationPath } from "@/lib/tenant/with-tenant";

export const CANDIDATE_BTN_NAVY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-secondary,#012352)] px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

export const CANDIDATE_BTN_OUTLINE =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#012352] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";

export const CANDIDATE_BTN_MUTED =
  "inline-flex h-9 items-center justify-center rounded-lg bg-[#F3F4F6] px-3 text-xs font-semibold text-[#111827] transition hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-50";

export const CANDIDATE_CARD_CLASS =
  "overflow-hidden rounded-xl border border-[#E5E7EB] bg-white";

export function CandidatePageIntro({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold leading-4 text-[color:var(--brand-primary,#BC8B41)]">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold leading-8 text-black" style={brandHeadingTextStyle(1.5)}>
          {title}
        </h1>
        <p className="mt-1 text-xs leading-4 text-[#6B7280]" style={brandBodyTextStyle(0.75)}>
          {subtitle}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CandidateSettingsTabs({ active }: { active: "profile" | "account" }) {
  const searchParams = useSearchParams();
  const tenant = searchParams?.get("tenant");
  const profileHref = applicationPath("/application/candidate/profile", tenant);
  const accountHref = applicationPath("/application/candidate/account", tenant);

  return (
    <nav className="mb-5 flex items-end gap-0 border-b border-transparent" aria-label="Profile and account">
      <Link
        href={profileHref}
        className={`border-b-2 px-4 pb-3 text-xs ${
          active === "profile"
            ? "border-[color:var(--brand-primary,#BC8B41)] font-medium text-[color:var(--brand-primary,#BC8B41)]"
            : "border-transparent font-normal text-[#6B7280] hover:text-[#111827]"
        }`}
        aria-current={active === "profile" ? "page" : undefined}
      >
        Profile
      </Link>
      <Link
        href={accountHref}
        className={`border-b-2 px-4 pb-3 text-xs ${
          active === "account"
            ? "border-[color:var(--brand-primary,#BC8B41)] font-medium text-[color:var(--brand-primary,#BC8B41)]"
            : "border-transparent font-normal text-[#6B7280] hover:text-[#111827]"
        }`}
        aria-current={active === "account" ? "page" : undefined}
      >
        Account
      </Link>
    </nav>
  );
}
