"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  TENANT_GOAL_OPTIONS,
  type TenantGoalId,
} from "@/app/tenant-onboarding/constants";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

function GoalCard({
  id,
  label,
  icon,
  selected,
  onToggle,
}: {
  id: TenantGoalId;
  label: string;
  icon: string;
  selected: boolean;
  onToggle: (id: TenantGoalId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-5 text-left transition ${
        selected
          ? "border-[#012352] bg-[#FBF8F2]"
          : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            selected ? "border-[#012352] bg-white" : "border-transparent bg-[#FBF8F2]"
          }`}
        >
          <Image src={icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
        </span>
        <span className="text-[14px] font-semibold leading-5 text-black" style={interStyle}>
          {label}
        </span>
      </span>
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-[#012352] bg-[#012352]" : "border-[#CBD5E1] bg-white"
        }`}
        aria-hidden
      >
        {selected ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.5"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

export default function LaunchPadPage() {
  const router = useRouter();
  const [selectedGoals, setSelectedGoals] = useState<TenantGoalId[]>(["hr_data_reporting"]);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (id: TenantGoalId) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((goal) => goal !== id) : [...prev, id]
    );
  };

  const persistGoals = async () => {
    setSaving(true);
    try {
      try {
        sessionStorage.setItem("braasLaunchPadGoals", JSON.stringify(selectedGoals));
      } catch {
        /* ignore */
      }
      router.push(ADMIN_RECRUITER_HOME_ROUTE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col bg-[#F4F4F4]">
      <div className="flex flex-1 flex-col gap-6 p-[30px]">
        <div className="flex w-full flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 text-black" style={interStyle}>
            What brings you to brassHR
          </h1>
          <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
            Choose what matters most to you, and we&apos;ll make sure to help you hit your goals.
          </p>
        </div>

        <div className="flex w-full flex-col gap-5 py-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {TENANT_GOAL_OPTIONS.map((goal) => (
              <GoalCard
                key={goal.id}
                id={goal.id}
                label={goal.label}
                icon={goal.icon}
                selected={selectedGoals.includes(goal.id)}
                onToggle={toggleGoal}
              />
            ))}
          </div>

          <div className="flex w-full items-center justify-between px-5 py-3.5">
            <button
              type="button"
              onClick={() => router.push(ADMIN_RECRUITER_HOME_ROUTE)}
              className="text-[12px] font-semibold leading-4 text-[#012352]"
              style={interStyle}
            >
              Skip for now
            </button>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold leading-5 text-[#012352]"
                style={interStyle}
              >
                Back
              </button>
              <button
                type="button"
                disabled={saving || selectedGoals.length === 0}
                onClick={() => void persistGoals()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-3.5 text-[14px] font-semibold leading-5 text-white disabled:opacity-60"
                style={interStyle}
              >
                {saving ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
