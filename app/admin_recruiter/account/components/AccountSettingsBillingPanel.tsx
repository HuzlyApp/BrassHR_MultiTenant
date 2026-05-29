"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Building2,
  ImageIcon,
  Info,
  Link2,
} from "lucide-react";

type BillingTab = "billing" | "subscription";

/** Figma selection colors — Account settings */
const COLORS = {
  brandPrimary: "#BC8B41",
  headingTitleDark: "#012352",
  textLabels: "#64748B",
  warning50: "#FDF8F3",
  bgPrimary: "#FFFFFF",
} as const;

type HeaderProfile = {
  first_name: string | null;
  last_name: string | null;
};

type AccountSettingsBillingPanelProps = {
  accountOwnerName?: string;
  accountNumber?: string;
  accountDomain?: string;
  loading?: boolean;
};

/** Fixed en-US format so SSR and client hydration match (avoids locale drift). */
function formatTrialEndDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AccountSettingsBillingPanel({
  accountOwnerName: accountOwnerNameProp,
  accountNumber = "785325",
  accountDomain = "trial1821he.brasshr.com",
  loading: loadingProp,
}: AccountSettingsBillingPanelProps = {}) {
  const [billingTab, setBillingTab] = useState<BillingTab>("billing");
  const [profileLoading, setProfileLoading] = useState(loadingProp ?? true);
  const [profileName, setProfileName] = useState(accountOwnerNameProp ?? "Mark Sutton");

  useEffect(() => {
    if (accountOwnerNameProp !== undefined) {
      setProfileName(accountOwnerNameProp);
      setProfileLoading(loadingProp ?? false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/header-data", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { profile?: HeaderProfile | null };
        const n = [payload.profile?.first_name, payload.profile?.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (active && n) setProfileName(n);
      } finally {
        if (active) setProfileLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accountOwnerNameProp, loadingProp]);

  const trialEndLabel = useMemo(() => formatTrialEndDate(28), []);
  const loading = loadingProp ?? profileLoading;
  const displayName = loading ? "—" : profileName || "Mark Sutton";
  const billToValue = displayName;

  return (
    <div
      className="mx-auto w-full max-w-[1300px] rounded-lg border border-[#D1D5DB] p-5 sm:p-6"
      style={{ backgroundColor: COLORS.bgPrimary }}
    >
      {/* Account header */}
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
              Nexus MedPro
            </h2>
            <div className="mt-2 space-y-1.5">
              <p
                className="flex items-center gap-2 text-sm"
                style={{ color: COLORS.textLabels }}
              >
                <Building2
                  className="h-4 w-4 shrink-0"
                  style={{ color: COLORS.brandPrimary }}
                  aria-hidden
                />
                Account #{accountNumber}
              </p>
              <p
                className="flex items-center gap-2 text-sm"
                style={{ color: COLORS.textLabels }}
              >
                <Link2
                  className="h-4 w-4 shrink-0"
                  style={{ color: COLORS.brandPrimary }}
                  aria-hidden
                />
                {accountDomain}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:shrink-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC]"
              aria-hidden
            >
              <ImageIcon className="h-6 w-6 text-[#CBD5E1]" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: COLORS.headingTitleDark }}>
                {displayName}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: COLORS.textLabels }}>
                Account Owner
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trial banner */}
      <div
        className="mt-5 flex items-center gap-4 rounded-xl border px-5 py-4 sm:px-6 sm:py-5"
        style={{
          borderColor: COLORS.brandPrimary,
          backgroundColor: COLORS.warning50,
        }}
        role="status"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white"
          style={{ borderColor: COLORS.brandPrimary }}
        >
          <Image
            src="/icons/braas-HR/client-dashboard/uil_rocket.svg"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6"
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: COLORS.headingTitleDark }}
          >
            Your free trial ends on {trialEndLabel} (28 days)
          </p>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: COLORS.textLabels }}>
            Reach out to our product specialist or give us a call at{" "}
            <span className="font-medium" style={{ color: COLORS.textLabels }}>
              +1-811-722-2235
            </span>{" "}
            to signup. Upgrade Anytime
          </p>
        </div>
      </div>

      {/* Billing / Subscription tabs */}
      <div className="mt-5 flex items-center gap-2">
        {(
          [
            { id: "billing" as const, label: "Billing" },
            { id: "subscription" as const, label: "Subscription" },
          ] as const
        ).map((tab) => {
          const isActive = billingTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBillingTab(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? "text-white" : "bg-transparent hover:opacity-90"
              }`}
              style={
                isActive
                  ? { backgroundColor: COLORS.brandPrimary }
                  : { color: COLORS.headingTitleDark }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {billingTab === "billing" ? (
        <div className="mt-6 space-y-6">
          {/* Billing Center */}
          <section>
            <div className="mb-3 flex items-center gap-1.5">
              <h3 className="text-base font-semibold text-[#1E3A5F]">Billing Center</h3>
              <button
                type="button"
                aria-label="Billing center info"
                className="text-[#9CA3AF] hover:text-[#6B7280]"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-[#E5E7EB] bg-white px-6 py-16">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#F3F4F6]">
                  <Image
                    src="/icons/braas-HR/client-dashboard/solar_folder-broken.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6"
                    aria-hidden
                  />
                </div>
                <p className="mt-4 text-base font-semibold text-[#111827]">Nothing to see here...</p>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Once you have an invoice history, you will see it here.
                </p>
              </div>
            </div>
          </section>

          {/* Billing Information */}
          <section>
            <h3 className="mb-4 text-base font-semibold text-[#1E3A5F]">Billing Information</h3>

            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-[#6B7280]">Customer</div>
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#1E3A5F] hover:underline"
                  >
                    Add
                    <Info className="h-3.5 w-3.5 text-[#9CA3AF]" aria-hidden />
                  </button>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-sm text-[#6B7280]">
                    Accounts Payable Emails
                    <Info className="h-3.5 w-3.5 text-[#9CA3AF]" aria-hidden />
                  </div>
                  <button
                    type="button"
                    className="mt-1 block text-sm font-medium text-[#1E3A5F] hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-sm text-[#6B7280]">Bill To</div>
                  <div className="mt-1 text-sm font-medium text-[#1E3A5F]">{billToValue}</div>
                </div>
                <div>
                  <div className="text-sm text-[#6B7280]">Company Tax ID</div>
                  <div className="mt-1 text-sm font-medium text-[#1E3A5F]">{billToValue}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-[#6B7280]">Primary Payment Method</div>
                <div className="mt-1 text-sm font-medium text-[#1E3A5F]">None</div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3
              className="text-base font-semibold sm:text-lg"
              style={{ color: COLORS.headingTitleDark }}
            >
              My Subscription
            </h3>
            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border bg-white px-5 text-sm font-medium transition hover:bg-[#F8FAFC]"
              style={{
                borderColor: COLORS.headingTitleDark,
                color: COLORS.headingTitleDark,
              }}
            >
              Manage Subscription
            </button>
          </div>

          <div
            className="flex flex-col gap-4 rounded-lg border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "#E5E7EB", backgroundColor: COLORS.bgPrimary }}
          >
            <div>
              <p
                className="text-base font-semibold leading-6"
                style={{ color: COLORS.headingTitleDark }}
              >
                Elite Pro
              </p>
              <p className="mt-0.5 text-sm" style={{ color: COLORS.textLabels }}>
                30 days trial
              </p>
            </div>
            <p
              className="text-sm sm:text-right"
              style={{ color: COLORS.textLabels }}
            >
              92 Members
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
