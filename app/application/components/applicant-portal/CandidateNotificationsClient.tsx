"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { applicantPortalApiPath } from "@/lib/applicant-portal/client-tenant";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { CANDIDATE_BTN_OUTLINE, CandidatePageIntro } from "./candidate-portal-ui";

type NotificationItem = {
  id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = Math.max(1, Math.round((Date.now() - date.getTime()) / 36e5));
  const days = Math.floor(hours / 24);
  const relative = hours < 24 ? `${hours} ${hours === 1 ? "hr" : "hrs"} ago` : `${days} ${days === 1 ? "day" : "days"} ago`;
  const absolute = date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${relative} · ${absolute}`;
}

export function CandidateNotificationsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(applicantPortalApiPath("/api/applicant-portal/notifications"), { headers, cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as {
        notifications?: NotificationItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load notifications.");
      setItems(payload.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, sessionReady]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(action: string, notificationId?: string) {
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(applicantPortalApiPath("/api/applicant-portal/notifications"), {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action, notificationId }),
      });
      const payload = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not update notifications.");
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update notifications.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 px-4 py-6 min-[1000px]:px-8">
      <CandidatePageIntro
        title="Notifications"
        subtitle="Stay updated with your latest alerts and updates."
        action={
          <button
            type="button"
            className={CANDIDATE_BTN_OUTLINE}
            disabled={busy || !items.some((item) => item.is_read !== true)}
            onClick={() => void patch("mark_notifications_read")}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        }
      />
      {error ? <p role="alert" className="mb-3 text-sm text-[#B91C1C]">{error}</p> : null}
      {loading ? <p className="text-sm text-[#6B7280]">Loading notifications…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-[#6B7280]">You have no notifications.</p>
      ) : null}
      <div className="space-y-5">
        {items.map((item) => {
          const unread = item.is_read !== true;
          return (
            <article
              key={item.id}
              className={`flex flex-col gap-3 rounded-xl border bg-white px-5 py-4 sm:flex-row sm:items-center ${
                unread ? "border-[#012352]" : "border-[#E5E7EB]"
              }`}
            >
              <span
                className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${
                  unread ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#FFEDD5] text-[#C2410C]"
                }`}
              >
                <Bell className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#012352]">{item.title || "Notification"}</p>
                {item.body ? <p className="text-xs text-[#6B7280]">{item.body}</p> : null}
              </div>
              <p className="text-[10px] leading-[15px] text-[#6B7280]">{formatWhen(item.sent_at)}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${CANDIDATE_BTN_OUTLINE} h-[30px] text-[10px]`}
                  disabled={busy || !item.link}
                  onClick={async () => {
                    if (await patch("mark_notification_read", item.id)) {
                      if (item.link) router.push(applicationPath(item.link, searchParams?.get("tenant")));
                    }
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  className={`${CANDIDATE_BTN_OUTLINE} h-[30px] text-[10px]`}
                  disabled={busy}
                  onClick={() => void patch("delete_notification", item.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
