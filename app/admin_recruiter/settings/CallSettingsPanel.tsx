"use client";

import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";

type Caller = {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  online: boolean;
};

const inputClassName =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

export default function CallSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [callers, setCallers] = useState<Caller[]>([]);
  const [userId, setUserId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/dialpad", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          configured?: boolean;
          callers?: Caller[];
          defaultUserId?: string | null;
        };
        if (!response.ok) throw new Error(payload.error || "Could not load Dialpad users");
        if (cancelled) return;
        const nextCallers = payload.callers ?? [];
        setConfigured(payload.configured !== false);
        setCallers(nextCallers);
        setUserId(payload.defaultUserId || nextCallers[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load Dialpad users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function placeCall(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    setCalling(true);
    try {
      const response = await fetch("/api/admin/dialpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, userId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        caller?: { name?: string };
        phoneNumber?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not place the call");
      const who = payload.caller?.name || "Dialpad";
      const number = payload.phoneNumber || phoneNumber;
      const message = `${who} is being rung. Answer on Dialpad to connect ${number}.`;
      setResult(message);
      toast.success("Call started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place the call");
    } finally {
      setCalling(false);
    }
  }

  if (loading) {
    return <div className="h-40 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" aria-busy="true" />;
  }

  if (!configured) {
    return (
      <div className="max-w-xl rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-sm text-[#6B7280]">
        Dialpad is not configured. Add BRASSHR_DIALPAD_API on the server, then reload this page.
      </div>
    );
  }

  return (
    <form onSubmit={placeCall} className="max-w-xl space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5">
      <p className="text-sm leading-5 text-[#6B7280]">
        Enter a number and choose who places the call. Dialpad rings that person&apos;s app or desk phone first.
        Answer there, and Dialpad connects the number.
      </p>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[#111827]">Call as</span>
        <select
          className={inputClassName}
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          required
          disabled={calling || callers.length === 0}
        >
          {callers.length === 0 ? <option value="">No Dialpad users</option> : null}
          {callers.map((caller) => (
            <option key={caller.id} value={caller.id}>
              {caller.name}
              {caller.phones[0] ? ` · ${caller.phones[0]}` : ""}
              {caller.online ? " · online" : ""}
            </option>
          ))}
        </select>
      </label>

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
          disabled={calling}
        />
      </label>

      <button
        type="submit"
        disabled={calling || callers.length === 0 || !phoneNumber.trim() || !userId}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {calling ? "Calling…" : "Call"}
      </button>

      {result ? (
        <p className="text-sm text-[#067647]" role="status">
          {result}
        </p>
      ) : null}
    </form>
  );
}
