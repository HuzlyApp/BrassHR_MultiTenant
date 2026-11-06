"use client";

import CallScreen, { type CallPhase } from "@/app/admin_recruiter/settings/CallScreen";
import {
  DIALPAD_CTI_SRC,
  dialpadCtiCommand,
  parseDialpadCtiEvent,
  postDialpadCti,
} from "@/lib/dialpad/cti";
import { formatPhoneDisplay, toE164 } from "@/lib/dialpad/phone";
import { useEffect, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";

type Caller = {
  id: string;
  name: string;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

type ActiveCall = {
  phoneLabel: string;
  e164: string;
  phase: CallPhase;
  muted: boolean;
  speakerOn: boolean;
  elapsedSeconds: number;
};

export default function CallSettingsPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [callers, setCallers] = useState<Caller[]>([]);
  const [dialpadUserId, setDialpadUserId] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [call, setCall] = useState<ActiveCall | null>(null);
  const callRef = useRef<ActiveCall | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/dialpad", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          callers?: Caller[];
        };
        if (!response.ok || cancelled) return;
        setCallers(payload.callers ?? []);
      })
      .catch(() => {
        /* The in-page dialer can still place a call without the company user list. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function post(command: ReturnType<typeof dialpadCtiCommand>) {
    postDialpadCti(iframeRef.current?.contentWindow, command);
  }

  function startDial(e164: string) {
    post(dialpadCtiCommand("enable_current_tab"));
    post(
      dialpadCtiCommand("initiate_call", {
        phone_number: e164,
        enable_current_tab: true,
      })
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const parsed = parseDialpadCtiEvent(event.data, event.origin);
      if (!parsed) return;
      if (parsed.method === "user_authentication") {
        setAuthenticated(parsed.authenticated);
        setDialpadUserId(parsed.authenticated ? parsed.userId : null);
        if (parsed.authenticated && callRef.current?.phase === "sign-in") {
          startDial(callRef.current.e164);
          setCall((current) => (current ? { ...current, phase: "ringing" } : current));
        }
        return;
      }
      if (parsed.state === "on") {
        setCall((current) => (current && current.phase !== "ended" ? { ...current, phase: "ringing" } : current));
        return;
      }
      setCall((current) =>
        current && (current.phase === "ringing" || current.phase === "sign-in")
          ? { ...current, phase: "connected", elapsedSeconds: 0 }
          : current
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (call?.phase !== "connected") return;
    const timer = window.setInterval(() => {
      setCall((current) =>
        current?.phase === "connected" ? { ...current, elapsedSeconds: current.elapsedSeconds + 1 } : current
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [call?.phase]);

  function placeCall(event: FormEvent) {
    event.preventDefault();
    const e164 = toE164(phoneNumber);
    if (!e164) {
      toast.error("Enter a phone number, including the country code for numbers outside the US.");
      return;
    }
    const next: ActiveCall = {
      phoneLabel: formatPhoneDisplay(e164),
      e164,
      phase: authenticated ? "ringing" : "sign-in",
      muted: false,
      speakerOn: true,
      elapsedSeconds: 0,
    };
    setCall(next);
    if (authenticated) startDial(e164);
  }

  function hangUp() {
    post(dialpadCtiCommand("hang_up_all_calls"));
    setCall((current) => (current ? { ...current, phase: "ended" } : current));
    window.setTimeout(() => setCall(null), 700);
  }

  function toggleMute() {
    const muted = !(call?.muted ?? false);
    post(dialpadCtiCommand(muted ? "mute_call" : "unmute_call"));
    setCall((current) => (current ? { ...current, muted } : current));
  }

  function toggleSpeaker() {
    setCall((current) => (current ? { ...current, speakerOn: !current.speakerOn } : current));
  }

  const signedInName = callers.find((caller) => caller.id === dialpadUserId)?.name ?? null;

  if (loading) {
    return <div className="h-40 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" aria-busy="true" />;
  }

  return (
    <>
      <form onSubmit={placeCall} className="max-w-xl space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5">
        <p className="text-sm leading-5 text-[#6B7280]">
          Enter a number and click Call. The ringing screen opens here, and Dialpad places the call from the
          account signed in on this page.
          {signedInName ? ` Signed in as ${signedInName}.` : ""}
        </p>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#111827]">Phone number</span>
          <input
            className={inputClassName}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(415) 555-0134"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            disabled={call !== null}
          />
        </label>

        <button
          type="submit"
          disabled={call !== null || !phoneNumber.trim()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          Call
        </button>
      </form>

      <iframe
        ref={iframeRef}
        title="Dialpad"
        src={process.env.NODE_ENV === "test" ? "about:blank" : DIALPAD_CTI_SRC}
        allow="microphone; speaker-selection; autoplay; hid"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin allow-forms"
        onLoad={() => post(dialpadCtiCommand("enable_current_tab"))}
        className={
          call?.phase === "sign-in"
            ? "fixed left-1/2 top-28 z-[90] h-[min(520px,calc(100vh-16rem))] w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border-0 bg-white shadow-2xl"
            : "pointer-events-none fixed top-0 left-0 z-[70] h-[520px] w-[400px] opacity-0"
        }
      />

      {call ? (
        <CallScreen
          phoneLabel={call.phoneLabel}
          phase={call.phase}
          muted={call.muted}
          speakerOn={call.speakerOn}
          elapsedSeconds={call.elapsedSeconds}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onHangUp={hangUp}
        />
      ) : null}
    </>
  );
}
