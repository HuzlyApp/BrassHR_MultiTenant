"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Theme } from "emoji-picker-react";

const CHAT_EMOJI_ICON = "/icons/chat-icons/emoji-happy.svg";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-[280px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#64748B]">
      Loading emojis...
    </div>
  ),
});

type Props = {
  onSelect: (emoji: string) => void;
  className?: string;
};

export default function ChatEmojiPicker({ onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label="Add emoji"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-6 w-6 items-center justify-center transition hover:opacity-80"
      >
        <Image
          src={CHAT_EMOJI_ICON}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute bottom-full right-0 z-30 mb-2 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
          <EmojiPicker
            open={open}
            theme={Theme.LIGHT}
            width={280}
            height={320}
            searchPlaceHolder="Search emoji"
            previewConfig={{ showPreview: false }}
            autoFocusSearch={false}
            onEmojiClick={(emojiData) => {
              onSelect(emojiData.emoji);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
