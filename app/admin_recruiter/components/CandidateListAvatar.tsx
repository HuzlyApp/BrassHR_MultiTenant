"use client";

import Image from "next/image";

const BRAND_AVATAR_GRADIENT =
  "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)";

function initialFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type CandidateListAvatarProps = {
  name: string;
  photoUrl?: string | null;
  className?: string;
};

/** Small round avatar for candidate list and card views. */
export function CandidateListAvatar({ name, photoUrl, className = "" }: CandidateListAvatarProps) {
  const trimmedPhoto = photoUrl?.trim();

  if (trimmedPhoto) {
    return (
      <div
        className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] ${className}`}
        aria-hidden
      >
        <Image src={trimmedPhoto} alt="" fill className="object-cover" sizes="32px" unoptimized />
      </div>
    );
  }

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold leading-none text-white ${className}`}
      style={{ background: BRAND_AVATAR_GRADIENT }}
      aria-hidden
    >
      {initialFromName(name || "")}
    </div>
  );
}
