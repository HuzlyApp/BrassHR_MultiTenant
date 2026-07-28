"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Theme } from "emoji-picker-react";

const CHAT_EMOJI_ICON = "/icons/chat-icons/emoji-happy.svg";
const PICKER_WIDTH = 280;
const PICKER_HEIGHT = 320;

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

type PickerCoords = {
  top: number;
  left: number;
};

export default function ChatEmojiPicker({ onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PickerCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const gap = 8;
      const viewportPad = 8;

      let left = rect.right - PICKER_WIDTH;
      left = Math.max(viewportPad, Math.min(left, window.innerWidth - PICKER_WIDTH - viewportPad));

      let top = rect.top - PICKER_HEIGHT - gap;
      if (top < viewportPad) {
        top = Math.min(rect.bottom + gap, window.innerHeight - PICKER_HEIGHT - viewportPad);
      }
      top = Math.max(viewportPad, top);

      setCoords({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const pickerPanel =
    open && mounted && coords
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[300] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-lg"
            style={{ top: coords.top, left: coords.left, width: PICKER_WIDTH }}
          >
            <EmojiPicker
              open={open}
              theme={Theme.LIGHT}
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
              searchPlaceHolder="Search emoji"
              previewConfig={{ showPreview: false }}
              autoFocusSearch={false}
              onEmojiClick={(emojiData) => {
                onSelect(emojiData.emoji);
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex shrink-0 items-center justify-center self-center ${className ?? ""}`}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add emoji"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-7 w-7 items-center justify-center transition hover:opacity-80"
      >
        <Image
          src={CHAT_EMOJI_ICON}
          alt=""
          width={28}
          height={28}
          className="block h-7 w-7 shrink-0"
          aria-hidden
        />
      </button>
      {pickerPanel}
    </div>
  );
}
