"use client";

import React from "react";
import { Users, UserX, Sparkles, UserCheck } from "lucide-react";
import { MobileCollapsibleMetrics } from "@/app/admin_recruiter/components/MobileCollapsibleMetrics";

export type WorkersMetricsCardsProps = {
  loading?: boolean;
  counts?: {
    active?: number;
    inactive?: number;
    assigned?: number;
    newlyOnboarded?: number;
  };
};

export function WorkersMetricsCards({ counts, loading = false }: WorkersMetricsCardsProps) {
  const activeCount = counts?.active ?? 0;
  const inactiveCount = counts?.inactive ?? 0;
  const assignedCount = counts?.assigned ?? 0;
  const newlyOnboardedCount = counts?.newlyOnboarded ?? 0;

  const cards = [
    {
      id: "active",
      label: "Active Workers",
      value: activeCount,
      icon: Users,
      iconBg: "bg-[rgba(99,53,255,0.12)]",
      iconColor: "#6335FF",
    },
    {
      id: "inactive",
      label: "Inactive Workers",
      value: inactiveCount,
      icon: UserX,
      iconBg: "bg-[rgba(0,78,255,0.12)]",
      iconColor: "#004EFF",
    },
    {
      id: "assigned",
      label: "Assigned to Client",
      value: assignedCount,
      icon: Sparkles,
      iconBg: "bg-[rgba(144,0,177,0.12)]",
      iconColor: "#9000B1",
    },
    {
      id: "newlyOnboarded",
      label: "Onboarding Workers",
      value: newlyOnboardedCount,
      icon: UserCheck,
      iconBg: "bg-[rgba(14,97,87,0.12)]",
      iconColor: "#0E6157",
    },
  ];

  return (
    <MobileCollapsibleMetrics className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className="flex h-full items-center gap-3.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-3 shadow-xs"
          >
            <div
              className={`flex size-[50px] shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
            >
              <IconComponent className="size-6" style={{ color: card.iconColor }} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-4 text-[#374151]">{card.label}</p>
              {card.id === "assigned" ? <p className="text-xs text-[#64748B]">Includes workers still onboarding</p> : null}
              <p className="text-2xl font-semibold leading-8 text-black">
                {loading ? <span aria-label={`Loading ${card.label}`} className="my-1 block h-6 w-12 animate-pulse rounded bg-slate-200" /> : card.value.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </MobileCollapsibleMetrics>
  );
}
