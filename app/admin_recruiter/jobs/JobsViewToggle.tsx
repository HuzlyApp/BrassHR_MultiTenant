"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

export type JobsListingView = "list" | "grid";

const LIST_ICON = "/icons/jobs-icons/list-view.svg";
const GRID_ICON = "/icons/jobs-icons/grid-view.svg";

type JobsViewToggleProps = {
  value: JobsListingView;
  onChange: (next: JobsListingView) => void;
};

export function JobsViewToggle({ value, onChange }: JobsViewToggleProps) {
  const branding = useTenantBranding();
  const options = [
    { id: "list" as const, label: "List view", src: LIST_ICON },
    { id: "grid" as const, label: "Grid view", src: GRID_ICON },
  ];

  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label="Jobs layout">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            onClick={() => onChange(option.id)}
            className={`inline-flex h-8 w-9 items-center justify-center rounded-lg border transition ${
              active ? "border-transparent" : "border-[#CBD5E1] bg-white hover:bg-[#F8FAFC]"
            }`}
            style={active ? { backgroundColor: branding.primaryHex } : undefined}
          >
            <span className="relative size-6 overflow-hidden" aria-hidden>
              <BrandedSvgIcon
                src={option.src}
                className={option.id === "list" ? "absolute left-[12.5%] top-[29.17%] h-[10px] w-[18px]" : "size-6"}
                color={active ? "#FFFFFF" : "#475569"}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
