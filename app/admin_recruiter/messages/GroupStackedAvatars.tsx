"use client";

import { nameInitials } from "@/app/admin_recruiter/messages/chat-ui";

export default function GroupStackedAvatars({
  initials,
  size = 30,
  max = 4,
}: {
  initials: string[];
  size?: number;
  max?: number;
}) {
  const visible = initials.filter(Boolean).slice(0, max);
  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
        }}
      >
        G
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {visible.map((initial, index) => (
        <div
          key={`${initial}-${index}`}
          className="relative flex items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
          style={{
            width: size,
            height: size,
            marginLeft: index === 0 ? 0 : -12,
            zIndex: visible.length - index,
            background:
              index % 2 === 0
                ? "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)"
                : "color-mix(in srgb, var(--brand-primary) 75%, #64748B)",
          }}
        >
          {initial || "?"}
        </div>
      ))}
    </div>
  );
}

export function SingleChatAvatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      {nameInitials(name)}
    </div>
  );
}
