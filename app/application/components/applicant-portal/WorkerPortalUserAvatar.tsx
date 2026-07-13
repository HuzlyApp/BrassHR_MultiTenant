"use client";

import type { CSSProperties } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

export function workerBrandedAvatarStyle(primaryHex: string, accentHex: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${primaryHex} 0%, ${accentHex} 100%)`,
  };
}

export function workerAvatarInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type WorkerPortalUserAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: 24 | 30 | 36;
  className?: string;
};

const SIZE_CLASS = {
  24: "h-6 w-6 text-[10px]",
  30: "h-[30px] w-[30px] text-[11px]",
  36: "h-9 w-9 text-[13px]",
} as const;

export function WorkerPortalUserAvatar({
  name,
  photoUrl,
  size = 30,
  className = "",
}: WorkerPortalUserAvatarProps) {
  const branding = useTenantBranding();
  const sizeClass = SIZE_CLASS[size];
  const avatarStyle = workerBrandedAvatarStyle(branding.primaryHex, branding.accentHex);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${className}`}
      style={avatarStyle}
      aria-hidden
    >
      {workerAvatarInitial(name)}
    </span>
  );
}
