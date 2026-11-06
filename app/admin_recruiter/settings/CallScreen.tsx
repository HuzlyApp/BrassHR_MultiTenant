"use client";

import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export type CallPhase = "sign-in" | "ringing" | "connected" | "ended";

type CallScreenProps = {
  phoneLabel: string;
  phase: CallPhase;
  muted: boolean;
  speakerOn: boolean;
  elapsedSeconds: number;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onHangUp: () => void;
};

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function statusLabel(phase: CallPhase, elapsedSeconds: number): string {
  if (phase === "sign-in") return "Sign in to Dialpad";
  if (phase === "connected") return formatElapsed(elapsedSeconds);
  if (phase === "ended") return "Call ended";
  return "Ringing";
}

export default function CallScreen({
  phoneLabel,
  phase,
  muted,
  speakerOn,
  elapsedSeconds,
  onToggleMute,
  onToggleSpeaker,
  onHangUp,
}: CallScreenProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onHangUp();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHangUp]);

  const ringing = phase === "ringing" || phase === "sign-in";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Calling ${phoneLabel}`}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0b141a] text-white"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-32">
        <div className="relative mb-8 flex size-40 items-center justify-center">
          {ringing ? (
            <>
              <span className="absolute inset-0 rounded-full bg-white/10 motion-safe:animate-ping" />
              <span className="absolute inset-4 rounded-full bg-white/10 motion-safe:animate-ping [animation-delay:300ms]" />
            </>
          ) : null}
          <div className="relative flex size-28 items-center justify-center rounded-full bg-[#1f2c34]">
            <Phone className="size-10" aria-hidden />
          </div>
        </div>
        <h2 className="max-w-md text-center text-[1.65rem] font-medium leading-tight">{phoneLabel}</h2>
        <p className="mt-2 text-sm text-[#8696a0]" role="status">
          {statusLabel(phase, elapsedSeconds)}
        </p>
        {phase === "sign-in" ? (
          <p className="mt-3 max-w-sm text-center text-sm text-[#8696a0]">
            Sign in with the Dialpad window, then this call will start.
          </p>
        ) : null}
      </div>

      <div className="flex items-start justify-center gap-12 pb-14">
        <button
          type="button"
          aria-pressed={muted}
          onClick={onToggleMute}
          className="flex w-16 flex-col items-center gap-2 text-xs text-[#e9edef]"
        >
          <span
            className={`flex size-14 items-center justify-center rounded-full ${
              muted ? "bg-white text-[#111b21]" : "bg-[#1f2c34] text-white"
            }`}
          >
            {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
          </span>
          Mute
        </button>

        <button
          type="button"
          onClick={onHangUp}
          aria-label="End call"
          className="flex size-16 items-center justify-center rounded-full bg-[#ea0038] text-white"
        >
          <PhoneOff className="size-7" />
        </button>

        <button
          type="button"
          aria-pressed={speakerOn}
          onClick={onToggleSpeaker}
          className="flex w-16 flex-col items-center gap-2 text-xs text-[#e9edef]"
        >
          <span
            className={`flex size-14 items-center justify-center rounded-full ${
              speakerOn ? "bg-white text-[#111b21]" : "bg-[#1f2c34] text-white"
            }`}
          >
            {speakerOn ? <Volume2 className="size-6" /> : <VolumeX className="size-6" />}
          </span>
          Speaker
        </button>
      </div>
    </div>,
    document.body
  );
}
