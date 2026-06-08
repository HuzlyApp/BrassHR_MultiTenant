"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { accountTabHref } from "../account-tabs";
import { AccountErrorBanner, AccountLoadingSkeleton } from "./AccountFormStatus";

type ChecklistItemData = {
  id: string;
  step: number;
  title: string;
  description: string;
  completed: boolean;
  href: string;
};

function ChecklistRow({ item }: { item: ChecklistItemData }) {
  const { completed, step, title, description, href } = item;

  return (
    <li
      className={`flex items-center gap-4 rounded-lg border px-4 py-4 sm:px-5 sm:py-5 ${
        completed
          ? "border-[color:var(--brand-primary)] bg-[#F4F4F4]"
          : "border-[#D1D5DB] bg-white"
      }`}
    >
      {completed ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white"
          style={{ borderColor: "var(--brand-primary)" }}
          aria-hidden
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Image
              src="/icons/arrow-white.svg"
              alt=""
              width={12}
              height={12}
              className="h-3 w-3"
              aria-hidden
            />
          </span>
        </span>
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-sm font-semibold"
          style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}
          aria-hidden
        >
          {step}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[#64748B]">{description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          href={href}
          className="rounded-md p-1 transition-opacity hover:opacity-80"
          style={{ color: "var(--brand-primary)" }}
          aria-label={`View ${title}`}
        >
          <Eye className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <Link
          href={href}
          className="rounded-md p-1 transition-opacity hover:opacity-80"
          style={{ color: "var(--brand-primary)" }}
          aria-label={`Edit ${title}`}
        >
          <Pencil className="h-5 w-5" strokeWidth={1.75} />
        </Link>
      </div>
    </li>
  );
}

export default function ChecklistTab() {
  const { checklist, loading, error } = useAccountData();

  const items: ChecklistItemData[] = [
    {
      id: "personal",
      step: 1,
      title: "Personal Information",
      description: "Complete your name and contact details.",
      completed: checklist?.profile_completed ?? false,
      href: accountTabHref("personal"),
    },
    {
      id: "business",
      step: 2,
      title: "Business Information",
      description: "Essential details about your business and operations.",
      completed: checklist?.business_info_completed ?? false,
      href: accountTabHref("business-info"),
    },
    {
      id: "settings",
      step: 3,
      title: "Account Settings",
      description: "Set your timezone, language, and notification preferences.",
      completed: checklist?.account_settings_completed ?? false,
      href: accountTabHref("account-settings"),
    },
    {
      id: "security",
      step: 4,
      title: "Security",
      description: "Update your password and secure your account.",
      completed: checklist?.security_completed ?? false,
      href: accountTabHref("security"),
    },
    {
      id: "email",
      step: 5,
      title: "Email Verification",
      description: "Verify your email address with Supabase Auth.",
      completed: checklist?.email_verified ?? false,
      href: accountTabHref("security"),
    },
    {
      id: "organization",
      step: 6,
      title: "Organization Setup",
      description: "Link and configure your organization.",
      completed: checklist?.organization_created ?? false,
      href: accountTabHref("business-info"),
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;

  if (loading) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      {error ? (
        <div className="px-5 pt-5 sm:px-6">
          <AccountErrorBanner message={error} />
        </div>
      ) : null}

      <div className="flex w-full items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Onboarding Checklist</h2>
        <p className="shrink-0 text-sm">
          <span className="font-semibold text-[#012352]">{completedCount}</span>
          <span className="text-[#64748B]"> of {totalCount} Completed</span>
        </p>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-3xl rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
          <ul className="flex flex-col gap-3" aria-label="Onboarding steps">
            {items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
