"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchZohoSignStatus,
  mapZohoStatusToLabel,
  sendAgreement,
  subscribeToZohoSignStatus,
  type ZohoSignDbStatus,
} from "@/lib/zoho-sign-status";

type RefreshMode = "realtime" | "polling";

type Props = {
  name: string;
  email: string;
  userId?: string;
  projectId?: string;
  mode?: RefreshMode;
};

export default function ZohoSignStatusSection({
  name,
  email,
  userId,
  projectId,
  mode = "realtime",
}: Props) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<ZohoSignDbStatus>("sent");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useMemo(() => mapZohoStatusToLabel(status), [status]);

  const handleSendAgreement = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await sendAgreement({
        name,
        email,
        user_id: userId,
        project_id: projectId,
      });
      setRequestId(response.request_id);
      setStatus(response.status || "sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send agreement");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!requestId || mode !== "polling") return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const row = await fetchZohoSignStatus({ requestId });
        if (!cancelled && row?.status) {
          setStatus(row.status);
        }
      } catch {
        // Polling should be resilient; keep retrying.
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mode, requestId]);

  useEffect(() => {
    if (!requestId || mode !== "realtime") return;
    return subscribeToZohoSignStatus({
      requestId,
      onStatusChange: (next) => setStatus(next.status),
      onError: (err) => setError(err.message),
    });
  }, [mode, requestId]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold text-slate-900">Sign your agreement</h3>
      <p className="mt-2 text-sm text-slate-600">[ Check your email to sign ]</p>

      {!requestId ? (
        <button
          type="button"
          onClick={handleSendAgreement}
          disabled={sending}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#0D9488] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send agreement email"}
        </button>
      ) : null}

      <p className="mt-4 text-sm text-slate-900">
        Status: <span className="font-semibold">{statusLabel}</span>
      </p>

      {requestId ? (
        <p className="mt-1 text-xs text-slate-500">Request ID: {requestId}</p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
