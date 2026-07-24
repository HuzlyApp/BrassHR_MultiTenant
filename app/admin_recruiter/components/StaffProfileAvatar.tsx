"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

function initialFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type StaffProfileAvatarProps = {
  name: string;
  photoUrl?: string | null;
  className?: string;
  size?: "sm" | "md";
};

const SIZE_CLASS = {
  sm: "h-[30px] w-[30px] text-[11px]",
  md: "h-10 w-10 text-sm",
} as const;

const IMAGE_SIZES = {
  sm: "30px",
  md: "40px",
} as const;

/** Staff profile avatar for header/sidebar — branding gradient fallback like candidate lists. */
export function StaffProfileAvatar({
  name,
  photoUrl,
  className = "",
  size = "sm",
}: StaffProfileAvatarProps) {
  const branding = useTenantBranding();
  const trimmedPhoto = photoUrl?.trim();
  const sizeClass = SIZE_CLASS[size];
  const avatarStyle = {
    background: `linear-gradient(135deg, ${branding.primaryHex} 0%, ${branding.accentHex} 100%)`,
  } as CSSProperties;

  if (trimmedPhoto) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] ${sizeClass} ${className}`}
        aria-hidden
      >
        <Image
          src={trimmedPhoto}
          alt=""
          fill
          className="object-cover"
          sizes={IMAGE_SIZES[size]}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-white ${sizeClass} ${className}`}
      style={avatarStyle}
      aria-hidden
    >
      {initialFromName(name || "")}
    </div>
  );
}
