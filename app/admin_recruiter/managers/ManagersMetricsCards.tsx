"use client";

import { Users, UserCheck, UserX } from "lucide-react";
import { MobileCollapsibleMetrics } from "@/app/admin_recruiter/components/MobileCollapsibleMetrics";

export type ManagersMetricsCardsProps = {
  loading?: boolean;
  counts?: {
    total?: number;
    active?: number;
    inactive?: number;
  };
};

export function ManagersMetricsCards({ counts, loading = false }: ManagersMetricsCardsProps) {
  const totalCount = counts?.total ?? 0;
  const activeCount = counts?.active ?? 0;
  const inactiveCount = counts?.inactive ?? 0;

  const cards = [
    {
      id: "total",
      label: "Total Managers",
      value: totalCount,
      icon: Users,
      iconBg: "bg-[rgba(99,53,255,0.12)]",
      iconColor: "#6335FF",
    },
    {
      id: "active",
      label: "Active Managers",
      value: activeCount,
      icon: UserCheck,
      iconBg: "bg-[rgba(14,97,87,0.12)]",
      iconColor: "#0E6157",
    },
    {
      id: "inactive",
      label: "Inactive Managers",
      value: inactiveCount,
      icon: UserX,
      iconBg: "bg-[rgba(0,78,255,0.12)]",
      iconColor: "#004EFF",
    },
  ];

  return (
    <MobileCollapsibleMetrics className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
              <p className="text-2xl font-semibold leading-8 text-black">
                {loading ? (
                  <span
                    aria-label={`Loading ${card.label}`}
                    className="my-1 block h-6 w-12 animate-pulse rounded bg-slate-200"
                  />
                ) : (
                  card.value.toLocaleString()
                )}
              </p>
            </div>
          </div>
        );
      })}
    </MobileCollapsibleMetrics>
  );
}
