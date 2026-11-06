"use client";

import CallScreen, { type CallPhase } from "@/app/admin_recruiter/settings/CallScreen";
import {
  DIALPAD_CTI_SRC,
  dialpadCtiCommand,
  parseDialpadCtiEvent,
  postDialpadCti,
} from "@/lib/dialpad/cti";
import { formatPhoneDisplay, toE164 } from "@/lib/dialpad/phone";
import type { DialpadCallLog } from "@/lib/dialpad/client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import toast from "react-hot-toast";

type Caller = {
  id: string;
  name: string;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

// `*` lets Dialpad's document, and any origin it redirects to or embeds, trigger
// the browser microphone prompt. A bare `microphone` token only covers the src origin.
const DIALPAD_IFRAME_ALLOW =
  "microphone *; camera *; speaker-selection *; autoplay *; display-capture *; hid *";

function callStateLabel(state: string): string {
  if (state === "hangup" || state === "transcription" || state === "recording") return "Ended";
  if (state === "voicemail") return "Voicemail";
  if (state === "missed") return "Missed";
  return state.slice(0, 1).toUpperCase() + state.slice(1);
}

function callDurationLabel(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "No answer";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function callWhenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type ActiveCall = {
  phoneLabel: string;
  e164: string;
  direction: "inbound" | "outbound";
  callId: string | null;
  phase: CallPhase;
  muted: boolean;
  speakerOn: boolean;
  elapsedSeconds: number;
};

export default function CallSettingsPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [callers, setCallers] = useState<Caller[]>([]);
  const [callLogs, setCallLogs] = useState<DialpadCallLog[]>([]);
  const [callLogsError, setCallLogsError] = useState<string | null>(null);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [dialpadUserId, setDialpadUserId] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [call, setCall] = useState<ActiveCall | null>(null);
  const callRef = useRef<ActiveCall | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  function applyDialpadPayload(payload: {
    callers?: Caller[];
    calls?: DialpadCallLog[];
    callsError?: string | null;
  }) {
    setCallers(payload.callers ?? []);
    setCallLogs(payload.calls ?? []);
    setCallLogsError(payload.callsError ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/dialpad", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          callers?: Caller[];
          calls?: DialpadCallLog[];
          callsError?: string | null;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setCallLogsError(payload.error ?? "Could not load Dialpad call logs.");
          return;
        }
        applyDialpadPayload(payload);
      })
      .catch(() => {
        if (!cancelled) setCallLogsError("Could not load Dialpad call logs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refreshCallLogs() {
    setRefreshingLogs(true);
    void fetch("/api/admin/dialpad", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          callers?: Caller[];
          calls?: DialpadCallLog[];
          callsError?: string | null;
          error?: string;
        };
        if (!response.ok) {
          setCallLogsError(payload.error ?? "Could not load Dialpad call logs.");
          return;
        }
        applyDialpadPayload(payload);
      })
      .catch(() => setCallLogsError("Could not load Dialpad call logs."))
      .finally(() => setRefreshingLogs(false));
  }

  const refreshCallLogsRef = useRef(refreshCallLogs);
  refreshCallLogsRef.current = refreshCallLogs;

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
        if (parsed.authenticated) setSigningIn(false);
        if (parsed.authenticated && callRef.current?.phase === "sign-in") {
          startDial(callRef.current.e164);
          setCall((current) => (current ? { ...current, phase: "ringing" } : current));
        }
        return;
      }
      if (parsed.state === "on") {
        const current = callRef.current;
        const outboundActive = current && current.direction === "outbound" && current.phase !== "ended";
        if (outboundActive) {
          setCall((active) => (active && active.phase !== "ended" ? { ...active, phase: "ringing" } : active));
          return;
        }
        const number = parsed.externalNumber ? formatPhoneDisplay(parsed.externalNumber) : "Unknown number";
        setCall({
          phoneLabel: parsed.contactName || number,
          e164: parsed.externalNumber ?? "",
          direction: "inbound",
          callId: parsed.callId,
          phase: "incoming",
          muted: false,
          speakerOn: true,
          elapsedSeconds: 0,
        });
        return;
      }
      const current = callRef.current;
      if (current?.direction === "inbound" && current.phase === "incoming") {
        setCall((active) => (active ? { ...active, phase: "ended" } : active));
        window.setTimeout(() => {
          setCall(null);
          refreshCallLogsRef.current();
        }, 700);
        return;
      }
      setCall((active) =>
        active && (active.phase === "ringing" || active.phase === "sign-in")
          ? { ...active, phase: "connected", elapsedSeconds: 0 }
          : active
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
      direction: "outbound",
      callId: null,
      phase: authenticated ? "ringing" : "sign-in",
      muted: false,
      speakerOn: true,
      elapsedSeconds: 0,
    };
    // Paint the call screen before Dialpad starts media. A fully transparent iframe
    // makes Chrome reject getUserMedia without showing the microphone prompt.
    flushSync(() => {
      setCall(next);
    });
    if (authenticated) startDial(e164);
  }

  function answer() {
    post(dialpadCtiCommand("answer_call"));
    setCall((current) => (current ? { ...current, phase: "connected", elapsedSeconds: 0 } : current));
  }

  function decline() {
    const callId = callRef.current?.callId;
    post(callId ? dialpadCtiCommand("decline_call", { call_id: callId }) : dialpadCtiCommand("decline_call"));
    setCall((current) => (current ? { ...current, phase: "ended" } : current));
    window.setTimeout(() => {
      setCall(null);
      refreshCallLogs();
    }, 700);
  }

  function hangUp() {
    post(dialpadCtiCommand("hang_up_all_calls"));
    setCall((current) => (current ? { ...current, phase: "ended" } : current));
    window.setTimeout(() => {
      setCall(null);
      refreshCallLogs();
    }, 700);
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
          Enter a number and click Call. Inbound calls to the Dialpad account signed in on this page also ring here
          while the page stays open.
          {signedInName ? ` Signed in as ${signedInName}.` : ""}
        </p>
        {authenticated ? null : (
          <button
            type="button"
            onClick={() => setSigningIn(true)}
            className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111827]"
          >
            Sign in to receive calls
          </button>
        )}

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

      <section className="mt-6 max-w-3xl space-y-3" aria-labelledby="dialpad-call-logs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="dialpad-call-logs" className="text-sm font-semibold text-[#111827]">
              Call logs
            </h2>
            <p className="text-xs leading-5 text-[#6B7280]">Ended Dialpad calls from the last 14 days.</p>
          </div>
          <button
            type="button"
            onClick={refreshCallLogs}
            disabled={refreshingLogs}
            className="inline-flex h-8 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] disabled:opacity-60"
          >
            {refreshingLogs ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {callLogsError ? (
          <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
            {callLogsError}
          </p>
        ) : null}

        {callLogs.length === 0 && !callLogsError ? (
          <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#6B7280]">
            No recent calls.
          </p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            {callLogs.map((entry) => {
              const number = entry.externalNumber ? formatPhoneDisplay(entry.externalNumber) : "Unknown number";
              const who = entry.contactName || number;
              return (
                <li key={entry.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                    {entry.direction === "inbound" ? "Inbound" : "Outbound"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111827]">{who}</p>
                    <p className="truncate text-xs text-[#6B7280]">
                      {entry.contactName ? `${number} · ` : ""}
                      {entry.targetName ? entry.targetName : "Dialpad"}
                    </p>
                  </div>
                  <div className="text-xs text-[#6B7280] sm:text-right">
                    <p>{callWhenLabel(entry.startedAt)}</p>
                    <p>
                      {callDurationLabel(entry.durationSeconds)} · {callStateLabel(entry.state)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <iframe
        ref={iframeRef}
        title="Dialpad"
        src={process.env.NODE_ENV === "test" ? "about:blank" : DIALPAD_CTI_SRC}
        allow={DIALPAD_IFRAME_ALLOW}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin allow-forms"
        onLoad={() => post(dialpadCtiCommand("enable_current_tab"))}
        className={
          call?.phase === "sign-in" || (signingIn && !authenticated)
            ? "fixed left-1/2 top-28 z-[90] h-[min(520px,calc(100vh-16rem))] w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border-0 bg-white shadow-2xl"
            : call
              ? "fixed top-0 left-0 z-[70] h-[520px] w-[400px] border-0 bg-white"
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
          onAnswer={answer}
          onDecline={decline}
        />
      ) : null}
    </>
  );
}
